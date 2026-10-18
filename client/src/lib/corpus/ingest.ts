import {
  CORPUS_SCHEMA_VERSION,
  type ArtifactMetadata,
  type CorpusChunk,
  type CorpusDocument,
  type CorpusDocumentType,
  type CorpusIngestInput,
  type CorpusIngestResult,
} from "./types";

const encoder = new TextEncoder();
const DEFAULT_TARGET_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

/** Canonical JSON is used before every hash; object key order is never implicit. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable in this runtime.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function contentId(value: unknown): Promise<string> {
  return `cid:sha256:${await sha256Hex(canonicalJson(value))}`;
}

export function normalizeCorpusText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tokenizeCorpusText(value: string): string[] {
  return normalizeCorpusText(value).match(/\S+/g) ?? [];
}

function cleanOptional(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function cleanTerms(values?: string[]): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function documentTypeFor(input: Pick<CorpusIngestInput, "filename" | "mimeType">): CorpusDocumentType {
  const filename = input.filename.toLowerCase();
  if (input.mimeType === "text/markdown" || filename.endsWith(".md") || filename.endsWith(".markdown")) return "markdown";
  if (input.mimeType === "text/plain" || filename.endsWith(".txt")) return "text";
  throw new Error("Only Markdown and plain-text corpus documents are supported in Phase 2.");
}

type CorpusSection = { heading: string | null; content: string };

export function splitCorpusSections(content: string, documentType: CorpusDocumentType): CorpusSection[] {
  if (documentType !== "markdown") return [{ heading: null, content }];

  const sections: CorpusSection[] = [];
  let heading: string | null = null;
  let lines: string[] = [];
  const flush = () => {
    const sectionContent = normalizeCorpusText(lines.join("\n"));
    if (sectionContent) sections.push({ heading, content: sectionContent });
    lines = [];
  };

  for (const line of content.split("\n")) {
    const match = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (match) {
      flush();
      heading = match[1].trim();
      continue;
    }
    lines.push(line);
  }
  flush();

  return sections.length ? sections : [{ heading: null, content }];
}

export function tokenWindows(tokens: string[], targetTokens = DEFAULT_TARGET_TOKENS, overlapTokens = DEFAULT_OVERLAP_TOKENS): Array<{ tokens: string[]; start: number; end: number }> {
  if (!Number.isInteger(targetTokens) || targetTokens < 1) throw new Error("targetTokens must be a positive integer.");
  if (!Number.isInteger(overlapTokens) || overlapTokens < 0 || overlapTokens >= targetTokens) {
    throw new Error("overlapTokens must be a non-negative integer smaller than targetTokens.");
  }

  const windows: Array<{ tokens: string[]; start: number; end: number }> = [];
  for (let start = 0; start < tokens.length;) {
    const end = Math.min(tokens.length, start + targetTokens);
    windows.push({ tokens: tokens.slice(start, end), start, end });
    if (end === tokens.length) break;
    start = end - overlapTokens;
  }
  return windows;
}

function metadataFor(input: CorpusIngestInput, documentType: CorpusDocumentType, section: string | null): ArtifactMetadata {
  return {
    source: cleanOptional(input.source) ?? "operator-upload",
    filename: input.filename.trim(),
    documentType,
    title: cleanOptional(input.title) ?? input.filename.trim(),
    section,
    tags: cleanTerms(input.tags),
    author: cleanOptional(input.author),
    timestamp: cleanOptional(input.timestamp),
    role: cleanOptional(input.role),
    scope: cleanOptional(input.scope),
    keywords: cleanTerms(input.keywords),
  };
}

/**
 * Pure local ingestion for trusted operator-provided text. PDF parsing, embeddings,
 * and retrieval are deliberately deferred to later phases.
 */
export async function ingestTextDocument(input: CorpusIngestInput): Promise<CorpusIngestResult> {
  const filename = input.filename.trim();
  if (!filename) throw new Error("A corpus filename is required.");

  const documentType = documentTypeFor(input);
  const normalized = normalizeCorpusText(input.content);
  if (!normalized) throw new Error("Corpus documents cannot be empty after normalization.");

  const targetTokens = input.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = input.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const documentMetadata = metadataFor(input, documentType, null);
  const sourceHash = await sha256Hex(canonicalJson({ schemaVersion: CORPUS_SCHEMA_VERSION, content: normalized, metadata: documentMetadata }));
  const documentId = `document:${sourceHash.slice(0, 32)}`;
  const createdAt = new Date().toISOString();
  const sections = splitCorpusSections(normalized, documentType);
  const chunks: CorpusChunk[] = [];
  let ordinal = 0;
  let documentTokenOffset = 0;

  for (const section of sections) {
    const tokens = tokenizeCorpusText(section.content);
    const metadata = metadataFor(input, documentType, section.heading);
    for (const window of tokenWindows(tokens, targetTokens, overlapTokens)) {
      ordinal += 1;
      const content = window.tokens.join(" ");
      const chunkHash = await sha256Hex(canonicalJson({ documentId, sourceHash, ordinal, section: metadata.section, content }));
      chunks.push({
        cid: `cid:sha256:${chunkHash}`,
        documentId,
        chunkId: `${documentId}:chunk:${ordinal}`,
        content,
        metadata,
        createdAt,
        sourceHash,
        chunkHash,
        tokenStart: documentTokenOffset + window.start,
        tokenEnd: documentTokenOffset + window.end,
        schemaVersion: CORPUS_SCHEMA_VERSION,
      });
    }
    documentTokenOffset += tokens.length;
  }

  const document: CorpusDocument = {
    id: documentId,
    cid: await contentId({ documentId, sourceHash, schemaVersion: CORPUS_SCHEMA_VERSION }),
    schemaVersion: CORPUS_SCHEMA_VERSION,
    sourceHash,
    metadata: documentMetadata,
    createdAt,
    updatedAt: createdAt,
    chunkCount: chunks.length,
  };

  return {
    document,
    chunks,
    warnings: [],
  };
}
