import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import { MistCore } from "../client/src/lib/mist/core";
import { MIST_RRF_CONSTANT } from "../client/src/lib/mist/types";
import type { EmbeddingProvider, EmbeddingProviderMetadata } from "../client/src/lib/embedding/types";
import { IndexedDbCorpusStore } from "../client/src/lib/storage/indexeddb-corpus-store";

class DeterministicMistEmbeddingProvider implements EmbeddingProvider {
  private state: EmbeddingProviderMetadata["status"] = "MODEL_NOT_INITIALIZED";
  calls = 0;

  constructor(
    private readonly vectors: Record<string, number[]>,
    private readonly fail = false,
  ) {}

  metadata(): EmbeddingProviderMetadata {
    return {
      model: "mist-test-local-model",
      modelVersion: "mist-test-v1",
      dimension: 3,
      runtime: "wasm",
      status: this.state,
      initializationCount: this.calls ? 1 : 0,
      cacheStatus: "CACHE_UNAVAILABLE",
      cacheEntriesBeforeLoad: null,
      cacheEntriesAfterLoad: null,
      lastError: this.state === "MODEL_ERROR" ? "local embedding failed" : null,
    };
  }

  async initialize(): Promise<EmbeddingProviderMetadata> {
    this.state = "MODEL_LOADING";
    return this.metadata();
  }

  async embed(text: string): Promise<number[]> {
    this.calls += 1;
    if (this.fail) {
      this.state = "MODEL_ERROR";
      throw new Error("local embedding failed");
    }
    const vector = this.vectors[text];
    if (!vector) throw new Error(`No deterministic vector is configured for: ${text}`);
    this.state = "MODEL_READY";
    return [...vector];
  }
}

function createStore(label: string) {
  return new IndexedDbCorpusStore(`keira-mist-core-${label}-${crypto.randomUUID()}`, indexedDB);
}

async function addDocument(
  store: IndexedDbCorpusStore,
  input: Parameters<typeof ingestTextDocument>[0],
) {
  const ingestion = await ingestTextDocument({ ...input, targetTokens: 50, overlapTokens: 0 });
  await store.putDocument(ingestion.document);
  for (const chunk of ingestion.chunks) await store.putChunk(chunk);
  return ingestion.chunks[0];
}

describe("MIST deterministic retrieval core", () => {
  it("executes L1-L7 deterministically and emits an auditable fusion trajectory", async () => {
    const store = createStore("complete");
    const anchor = await addDocument(store, {
      filename: "anchor.md",
      mimeType: "text/markdown",
      source: "operator-ledger",
      title: "Alpha Governance Anchor",
      tags: ["governance"],
      content: "# Anchor\nalpha governance anchors local evidence",
    });
    const bridge = await addDocument(store, {
      filename: "bridge.md",
      mimeType: "text/markdown",
      source: "operator-ledger",
      title: "Orbital Bridge Ledger",
      tags: ["governance", "orbital"],
      scope: "bridge",
      content: "# Bridge\nalpha policy bridge connects governance and orbital evidence",
    });
    const orbital = await addDocument(store, {
      filename: "orbital.md",
      mimeType: "text/markdown",
      source: "archive",
      title: "Orbital Dossier",
      tags: ["orbital"],
      content: "# Orbit\norbital signal charts mountain evidence",
    });
    const unrelated = await addDocument(store, {
      filename: "delta.md",
      mimeType: "text/markdown",
      source: "archive",
      title: "Delta Record",
      tags: ["archive"],
      content: "# Delta\ndelta unrelated record",
    });

    const query = "alpha orbital governance";
    const provider = new DeterministicMistEmbeddingProvider({
      [anchor.content]: [1, 0, 0],
      [bridge.content]: [0.7, 0.7, 0],
      [orbital.content]: [0, 1, 0],
      [unrelated.content]: [0, 0, 1],
      [query]: [0.7, 0.7, 0],
    });
    const mist = new MistCore(store, provider);

    const first = await mist.retrieve(query);
    const second = await mist.retrieve(query);

    const { indexing: firstIndexing, ...firstTrajectory } = first;
    const { indexing: secondIndexing, ...secondTrajectory } = second;
    expect(firstTrajectory).toEqual(secondTrajectory);
    expect(first.status).toBe("COMPLETE");
    expect(first.query.tokens).toEqual(["alpha", "orbital", "governance"]);
    expect(first.lexical.id).toBe("L1_LEXICAL");
    expect(first.lexical.status).toBe("EXECUTED");
    expect(first.lexical.candidates[0].artifact.cid).toBe(bridge.cid);
    expect(first.lexical.candidates[0].score).toBe(1);
    expect(first.semantic.id).toBe("L2_SEMANTIC");
    expect(first.semantic.candidates[0]).toMatchObject({ artifact: { cid: bridge.cid }, score: 1, model: "mist-test-local-model" });
    expect(first.centroid.id).toBe("L3_CENTROID");
    expect(first.centroid.candidates).toHaveLength(3);
    expect(first.echoes.id).toBe("L4_ECHOES");
    expect(first.echoes.candidates.length).toBeGreaterThan(0);
    expect(first.echoes.candidates.every((echo) => echo.similarity > 0.6 && echo.distance === 1 - echo.similarity)).toBe(true);
    expect(first.echoes.candidates[0]).toMatchObject({
      centroidId: expect.stringMatching(/^centroid:/),
      sourceArtifactCid: expect.stringMatching(/^cid:sha256:/),
      layerScore: expect.any(Number),
    });
    expect(first.patterns.id).toBe("L5_PATTERNS");
    expect(first.patterns.candidates.length).toBeGreaterThan(0);
    expect(first.patterns.candidates.every((pattern) => pattern.clusterIds.length === 2 && pattern.crossClusterRelevance >= 0.2)).toBe(true);
    expect(first.patterns.candidates[0].bridgeScore).toBeCloseTo(
      first.patterns.candidates[0].similarityToClusterA
        + first.patterns.candidates[0].similarityToClusterB
        + first.patterns.candidates[0].crossClusterRelevance,
    );
    expect(first.arcana.id).toBe("L6_ARCANA");
    expect(first.arcana.candidates.some((arcana) => arcana.artifact.cid === bridge.cid && arcana.matchedMetadata.includes("tags"))).toBe(true);
    expect(first.fusion).toMatchObject({ id: "L7_RRF_FUSION", status: "EXECUTED", rrfConstant: MIST_RRF_CONSTANT });
    expect(first.fusion.candidates).toHaveLength(first.trajectoryArtifacts.length);
    expect(first.fusion.candidates[0].artifact.cid).toBe(bridge.cid);
    expect(first.fusion.candidates[0].rrfScore).toBeCloseTo(Object.values(first.fusion.candidates[0].layerRanks).reduce((sum, rank) => sum + 1 / (MIST_RRF_CONSTANT + (rank ?? 0)), 0));
    expect(first.trajectoryArtifacts.every((artifact) => artifact.fusionRank > 0 && artifact.rrfScore > 0 && artifact.layerMemberships.length > 0)).toBe(true);
    expect(firstIndexing).toMatchObject({ scannedChunks: 4, indexedChunks: 4, reusedEmbeddings: 0, dimension: 3 });
    expect(secondIndexing).toMatchObject({ scannedChunks: 4, indexedChunks: 0, reusedEmbeddings: 4, dimension: 3 });
    store.close();
  });

  it("returns an explicit empty trajectory without initializing a model when no corpus exists", async () => {
    const store = createStore("empty");
    const provider = new DeterministicMistEmbeddingProvider({});
    const result = await new MistCore(store, provider).retrieve("unavailable evidence");

    expect(result.status).toBe("EMPTY_CORPUS");
    expect(result.indexing).toBeNull();
    expect(result.lexical.status).toBe("EMPTY");
    expect(result.semantic.status).toBe("EMPTY");
    expect(result.centroid.status).toBe("EMPTY");
    expect(result.echoes.status).toBe("EMPTY");
    expect(result.patterns.status).toBe("EMPTY");
    expect(result.arcana.status).toBe("EMPTY");
    expect(result.fusion.status).toBe("EMPTY");
    expect(result.trajectoryArtifacts).toEqual([]);
    expect(provider.calls).toBe(0);
    store.close();
  });

  it("fails closed into an explicit partial result when local embeddings are unavailable", async () => {
    const store = createStore("unavailable");
    const chunk = await addDocument(store, {
      filename: "evidence.md",
      mimeType: "text/markdown",
      tags: ["governance"],
      content: "# Evidence\nalpha governance evidence",
    });
    const result = await new MistCore(store, new DeterministicMistEmbeddingProvider({}, true)).retrieve("alpha governance");

    expect(result.status).toBe("PARTIAL");
    expect(result.lexical.candidates[0].artifact.cid).toBe(chunk.cid);
    expect(result.arcana.candidates[0].artifact.cid).toBe(chunk.cid);
    expect(result.semantic).toMatchObject({ status: "UNAVAILABLE", candidates: [] });
    expect(result.centroid).toMatchObject({ status: "UNAVAILABLE", candidates: [] });
    expect(result.echoes).toMatchObject({ status: "UNAVAILABLE", candidates: [] });
    expect(result.patterns).toMatchObject({ status: "UNAVAILABLE", candidates: [] });
    expect(result.fusion.status).toBe("EXECUTED");
    expect(result.fusion.reason).toContain("Semantic layers were unavailable");
    expect(result.fusion.candidates[0].layerMemberships).toEqual(["L1_LEXICAL", "L6_ARCANA"]);
    store.close();
  });
});
