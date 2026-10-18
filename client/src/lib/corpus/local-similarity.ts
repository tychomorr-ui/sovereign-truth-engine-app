import { normalizeCorpusText } from "./ingest";
import { CORPUS_SCHEMA_VERSION, type CorpusEmbedding, type CorpusEmbeddingIndexResult, type CorpusSimilaritySearchQuery, type CorpusSimilaritySearchResult } from "./types";
import type { EmbeddingProvider, EmbeddingProviderMetadata } from "../embedding/types";
import type { CorpusStore } from "../storage/interface";

function requireDimension(metadata: EmbeddingProviderMetadata): number {
  if (!Number.isInteger(metadata.dimension) || metadata.dimension < 1) {
    throw new Error("Local embedding provider declared an invalid vector dimension.");
  }
  return metadata.dimension;
}

function hasExpectedVector(vector: number[], dimension: number): boolean {
  return vector.length === dimension && vector.every(Number.isFinite);
}

function assertReadyVector(vector: number[], metadata: EmbeddingProviderMetadata): void {
  const dimension = requireDimension(metadata);
  if (metadata.status !== "MODEL_READY") {
    throw new Error(`Local embedding provider did not reach MODEL_READY; current status is ${metadata.status}.`);
  }
  if (!hasExpectedVector(vector, dimension)) {
    throw new Error(`Local embedding vector must contain ${dimension} finite values.`);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new Error("Cosine similarity requires non-zero finite embedding vectors.");
  }
  return dotProduct / denominator;
}

function clampLimit(value: number | undefined): number {
  return Math.max(1, Math.min(200, Math.floor(value ?? 50)));
}

function clampMinimumScore(value: number | undefined): number {
  if (value === undefined) return -1;
  if (!Number.isFinite(value)) throw new Error("Similarity minimum score must be finite.");
  return Math.max(-1, Math.min(1, value));
}

function matchesProvider(embedding: CorpusEmbedding, metadata: EmbeddingProviderMetadata): boolean {
  return embedding.model === metadata.model
    && embedding.modelVersion === metadata.modelVersion
    && hasExpectedVector(embedding.vector, requireDimension(metadata));
}

/**
 * Local-only bridge between the verified embedding provider and the browser's
 * IndexedDB-backed CorpusStore. It never calls hosted inference, never falls
 * back to lexical results, and only compares vectors from the active exact
 * model/version provenance pair.
 */
export class LocalCorpusSimilarityService {
  constructor(
    private readonly store: CorpusStore,
    private readonly provider: EmbeddingProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async index(documentId?: string): Promise<CorpusEmbeddingIndexResult> {
    const baseline = this.provider.metadata();
    const dimension = requireDimension(baseline);
    const chunks = await this.store.listChunks(documentId);
    let indexedChunks = 0;
    let reusedEmbeddings = 0;

    for (const chunk of chunks) {
      const existing = await this.store.getEmbedding(chunk.cid);
      if (existing && matchesProvider(existing, baseline)) {
        reusedEmbeddings += 1;
        continue;
      }

      const vector = await this.provider.embed(chunk.content);
      const observed = this.provider.metadata();
      if (observed.model !== baseline.model || observed.modelVersion !== baseline.modelVersion || observed.dimension !== dimension) {
        throw new Error("Local embedding provider provenance changed during corpus indexing.");
      }
      assertReadyVector(vector, observed);
      await this.store.putEmbedding({
        chunkCid: chunk.cid,
        model: observed.model,
        modelVersion: observed.modelVersion,
        vector: [...vector],
        createdAt: this.now().toISOString(),
        schemaVersion: CORPUS_SCHEMA_VERSION,
      });
      indexedChunks += 1;
    }

    return {
      documentId: documentId ?? null,
      scannedChunks: chunks.length,
      indexedChunks,
      reusedEmbeddings,
      model: baseline.model,
      modelVersion: baseline.modelVersion,
      dimension,
    };
  }

  async search(query: CorpusSimilaritySearchQuery): Promise<CorpusSimilaritySearchResult[]> {
    const normalizedQuery = normalizeCorpusText(query.query);
    if (!normalizedQuery) throw new Error("Similarity search query cannot be empty.");

    const vector = await this.provider.embed(normalizedQuery);
    const observed = this.provider.metadata();
    assertReadyVector(vector, observed);
    const minimumScore = clampMinimumScore(query.minScore);
    const limit = clampLimit(query.limit);
    const chunks = await this.store.listChunks(query.documentId);
    const chunkByCid = new Map(chunks.map((chunk) => [chunk.cid, chunk]));
    const embeddings = await this.store.listEmbeddings();

    return embeddings
      .filter((embedding) => matchesProvider(embedding, observed))
      .map((embedding) => {
        const artifact = chunkByCid.get(embedding.chunkCid);
        if (!artifact) return null;
        return {
          artifact,
          score: cosineSimilarity(vector, embedding.vector),
          mode: "semantic_similarity" as const,
          embedding: {
            model: embedding.model,
            modelVersion: embedding.modelVersion,
          },
        };
      })
      .filter((result): result is CorpusSimilaritySearchResult => result !== null && result.score >= minimumScore)
      .sort((left, right) => right.score - left.score || left.artifact.cid.localeCompare(right.artifact.cid))
      .slice(0, limit);
  }
}
