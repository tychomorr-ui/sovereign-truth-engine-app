import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import { LocalCorpusSimilarityService } from "../client/src/lib/corpus/local-similarity";
import type { EmbeddingProvider, EmbeddingProviderMetadata } from "../client/src/lib/embedding/types";
import { IndexedDbCorpusStore } from "../client/src/lib/storage/indexeddb-corpus-store";

class DeterministicLocalEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly model = "keira-test-minilm",
    private readonly modelVersion = "test-v1",
    private readonly vectors: Record<string, number[]> = {},
  ) {}

  private status: EmbeddingProviderMetadata["status"] = "MODEL_NOT_INITIALIZED";
  calls = 0;

  metadata(): EmbeddingProviderMetadata {
    return {
      model: this.model,
      modelVersion: this.modelVersion,
      dimension: 3,
      runtime: "wasm",
      status: this.status,
      initializationCount: this.calls > 0 ? 1 : 0,
      cacheStatus: "CACHE_UNAVAILABLE",
      cacheEntriesBeforeLoad: null,
      cacheEntriesAfterLoad: null,
      lastError: null,
    };
  }

  async initialize(): Promise<EmbeddingProviderMetadata> {
    this.status = "MODEL_LOADING";
    return this.metadata();
  }

  async embed(text: string): Promise<number[]> {
    this.calls += 1;
    this.status = "MODEL_READY";
    const vector = this.vectors[text] ?? (text.includes("river") ? [1, 0, 0] : text.includes("mountain") ? [0, 1, 0] : [0, 0, 1]);
    return [...vector];
  }
}

function createStore(label: string) {
  return new IndexedDbCorpusStore(`keira-corpus-similarity-${label}-${crypto.randomUUID()}`, indexedDB);
}

describe("browser-local corpus similarity", () => {
  it("indexes corpus chunks with model provenance and ranks exact-model vectors by cosine similarity", async () => {
    const ingestion = await ingestTextDocument({
      filename: "places.md",
      mimeType: "text/markdown",
      content: "# River\nriver water current\n\n# Mountain\nmountain stone summit",
      targetTokens: 3,
      overlapTokens: 0,
    });
    const store = createStore("rank");
    await store.putDocument(ingestion.document);
    for (const chunk of ingestion.chunks) await store.putChunk(chunk);

    const provider = new DeterministicLocalEmbeddingProvider();
    const service = new LocalCorpusSimilarityService(store, provider, () => new Date("2026-10-18T00:00:00.000Z"));
    const indexed = await service.index(ingestion.document.id);

    expect(indexed).toEqual({
      documentId: ingestion.document.id,
      scannedChunks: ingestion.chunks.length,
      indexedChunks: ingestion.chunks.length,
      reusedEmbeddings: 0,
      model: "keira-test-minilm",
      modelVersion: "test-v1",
      dimension: 3,
    });
    expect(await store.getStats()).toMatchObject({ chunks: ingestion.chunks.length, embeddings: ingestion.chunks.length });

    const results = await service.search({ query: "river query", documentId: ingestion.document.id, limit: 2, minScore: 0.1 });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      mode: "semantic_similarity",
      score: 1,
      embedding: { model: "keira-test-minilm", modelVersion: "test-v1" },
    });
    expect(results[0].artifact.content).toContain("river");

    const repeated = await service.index(ingestion.document.id);
    expect(repeated.indexedChunks).toBe(0);
    expect(repeated.reusedEmbeddings).toBe(ingestion.chunks.length);
    store.close();
  });

  it("excludes stale model provenance and refuses malformed local vectors", async () => {
    const ingestion = await ingestTextDocument({ filename: "evidence.txt", mimeType: "text/plain", content: "river evidence remains bounded." });
    const store = createStore("provenance");
    await store.putDocument(ingestion.document);
    for (const chunk of ingestion.chunks) await store.putChunk(chunk);

    const primary = new DeterministicLocalEmbeddingProvider("keira-test-minilm", "v1");
    const index = new LocalCorpusSimilarityService(store, primary);
    await index.index();

    const changedModel = new DeterministicLocalEmbeddingProvider("keira-test-minilm", "v2");
    const searchWithChangedModel = new LocalCorpusSimilarityService(store, changedModel);
    await expect(searchWithChangedModel.search({ query: "river" })).resolves.toEqual([]);

    const malformed = new DeterministicLocalEmbeddingProvider("keira-test-minilm", "v3", { "river evidence remains bounded.": [1, Number.NaN, 0] });
    const malformedIndex = new LocalCorpusSimilarityService(store, malformed);
    await expect(malformedIndex.index()).rejects.toThrow("finite values");
    expect((await store.getEmbedding(ingestion.chunks[0].cid))?.modelVersion).toBe("v1");
    await expect(index.search({ query: "  \n " })).rejects.toThrow("cannot be empty");
    store.close();
  });
});
