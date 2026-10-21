import { createHash } from "node:crypto";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import type { CorpusEmbedding, CorpusIngestResult } from "../client/src/lib/corpus/types";
import { getDb } from "./db";
import { keiraCorpusVectors } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";

const VECTOR_DIMENSION = 384;

function localVector(text: string): number[] {
  const vector = new Array<number>(VECTOR_DIMENSION).fill(0);
  const normalized = text.normalize("NFKC").toLowerCase();
  for (let index = 0; index < normalized.length; index += 1) {
    const digest = createHash("sha256").update(`${index}:${normalized[index]}`).digest();
    const slot = digest.readUInt32BE(0) % VECTOR_DIMENSION;
    vector[slot] += (digest[4] / 255) * 2 - 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector;
}

export type IngestedCorpusDocument = CorpusIngestResult & {
  embeddings: CorpusEmbedding[];
  embedding: {
    model: "keira-local-deterministic";
    modelVersion: "v1";
    dimension: number;
    runtime: "server-local";
  };
};

type StoredCorpus = IngestedCorpusDocument;
const corpusByUser = new Map<number, Map<string, StoredCorpus>>();

export async function ingestCorpusDocument(input: {
  filename: string;
  mimeType: "text/plain" | "text/markdown";
  content: string;
}, userId?: number): Promise<IngestedCorpusDocument> {
  const result = await ingestTextDocument({
    filename: input.filename,
    mimeType: input.mimeType,
    content: input.content,
    source: "operator-upload",
  });
  const embeddings = result.chunks.map((chunk) => ({
    chunkCid: chunk.cid,
    model: "keira-local-deterministic" as const,
    modelVersion: "v1",
    vector: localVector(chunk.content),
    createdAt: chunk.createdAt,
    schemaVersion: "1.0.0" as const,
  }));
  const stored: IngestedCorpusDocument = {
    ...result,
    embeddings,
    embedding: {
      model: "keira-local-deterministic",
      modelVersion: "v1",
      dimension: VECTOR_DIMENSION,
      runtime: "server-local",
    },
  };
  if (userId !== undefined) {
    const documents = corpusByUser.get(userId) ?? new Map<string, StoredCorpus>();
    documents.set(stored.document.id, stored);
    corpusByUser.set(userId, documents);
    const db = await getDb();
    if (db) {
      await db.delete(keiraCorpusVectors).where(and(eq(keiraCorpusVectors.userId, userId), eq(keiraCorpusVectors.documentId, stored.document.id)));
      await db.insert(keiraCorpusVectors).values(stored.chunks.map((chunk) => ({
        id: `${userId}:${chunk.cid}`,
        userId,
        documentId: stored.document.id,
        artifactCid: chunk.cid,
        filename: stored.document.metadata.filename,
        content: chunk.content,
        vectorJson: JSON.stringify(stored.embeddings.find((embedding) => embedding.chunkCid === chunk.cid)?.vector ?? []),
      })));
    }
  }
  return stored;
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator > 0 ? dot / denominator : -1;
}

export async function searchStoredCorpusEvidence(userId: number, query: string, limit = 8): Promise<Array<{ cid: string; snippet: string; score: number }>> {
  const queryVector = localVector(query);
  const records = Array.from(corpusByUser.get(userId)?.values() ?? []);
  const memoryResults = records.flatMap((record) => record.chunks.map((chunk) => {
    const embedding = record.embeddings.find((item) => item.chunkCid === chunk.cid);
    return embedding ? { cid: chunk.cid, snippet: chunk.content, score: cosine(queryVector, embedding.vector) } : null;
  })).filter((item): item is { cid: string; snippet: string; score: number } => item !== null)
    .sort((left, right) => right.score - left.score || left.cid.localeCompare(right.cid))
    .slice(0, Math.max(1, Math.min(12, limit)));
  const db = await getDb();
  if (db) {
    const rows = await db.select().from(keiraCorpusVectors).where(eq(keiraCorpusVectors.userId, userId));
    const durableResults = rows.map((row) => {
      try {
        return { cid: row.artifactCid, snippet: row.content, score: cosine(queryVector, JSON.parse(row.vectorJson) as number[]) };
      } catch {
        return null;
      }
    }).filter((item): item is { cid: string; snippet: string; score: number } => item !== null)
      .sort((left, right) => right.score - left.score || left.cid.localeCompare(right.cid));
    if (durableResults.length) return durableResults.slice(0, Math.max(1, Math.min(12, limit)));
  }
  return memoryResults;
}
