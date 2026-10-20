import { createHash } from "node:crypto";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import type { CorpusEmbedding, CorpusIngestResult } from "../client/src/lib/corpus/types";

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

export async function ingestCorpusDocument(input: {
  filename: string;
  mimeType: "text/plain" | "text/markdown";
  content: string;
}): Promise<IngestedCorpusDocument> {
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
  return {
    ...result,
    embeddings,
    embedding: {
      model: "keira-local-deterministic",
      modelVersion: "v1",
      dimension: VECTOR_DIMENSION,
      runtime: "server-local",
    },
  };
}
