import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ingestTextDocument, normalizeCorpusText, tokenWindows } from "../client/src/lib/corpus/ingest";
import { IndexedDbCorpusStore } from "../client/src/lib/storage/indexeddb-corpus-store";

function createStore(label: string) {
  return new IndexedDbCorpusStore(`keira-corpus-test-${label}-${crypto.randomUUID()}`, indexedDB);
}

describe("Phase 2 browser-local corpus foundation", () => {
  it("normalizes deterministically and creates token-aware overlapping chunks with content-addressed IDs", async () => {
    expect(normalizeCorpusText("  KEIRA\r\n\r\nCorpus  ")).toBe("KEIRA\n\nCorpus");
    expect(tokenWindows(["one", "two", "three", "four", "five", "six", "seven"], 5, 2)).toEqual([
      { tokens: ["one", "two", "three", "four", "five"], start: 0, end: 5 },
      { tokens: ["four", "five", "six", "seven"], start: 3, end: 7 },
    ]);

    const result = await ingestTextDocument({
      filename: "runtime.md",
      mimeType: "text/markdown",
      source: "operator-upload",
      tags: ["runtime", "local", "runtime"],
      content: "# Runtime\nKEIRA remains local first.\n\n## Evidence\nGenerated inference is not fact.",
      targetTokens: 5,
      overlapTokens: 1,
    });

    expect(result.document.id).toMatch(/^document:[a-f0-9]{32}$/);
    expect(result.document.cid).toMatch(/^cid:sha256:[a-f0-9]{64}$/);
    expect(result.document.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.document.metadata.tags).toEqual(["local", "runtime"]);
    expect(result.chunks.length).toBeGreaterThan(1);
    expect(result.chunks.every((chunk) => chunk.cid.startsWith("cid:sha256:") && chunk.sourceHash === result.document.sourceHash)).toBe(true);
    expect(result.chunks.some((chunk) => chunk.metadata.section === "Evidence")).toBe(true);

    const repeated = await ingestTextDocument({
      filename: "runtime.md",
      mimeType: "text/markdown",
      source: "operator-upload",
      tags: ["runtime", "local", "runtime"],
      content: "# Runtime\nKEIRA remains local first.\n\n## Evidence\nGenerated inference is not fact.",
      targetTokens: 5,
      overlapTokens: 1,
    });
    expect(repeated.document.sourceHash).toBe(result.document.sourceHash);
    expect(repeated.document.cid).toBe(result.document.cid);
    expect(repeated.chunks.map((chunk) => chunk.cid)).toEqual(result.chunks.map((chunk) => chunk.cid));
  });

  it("rejects unsupported input rather than pretending PDF ingestion exists", async () => {
    await expect(ingestTextDocument({ filename: "evidence.pdf", mimeType: "application/pdf" as never, content: "not parsed" })).rejects.toThrow("Only Markdown and plain-text");
    await expect(ingestTextDocument({ filename: "empty.txt", mimeType: "text/plain", content: "   \n\n " })).rejects.toThrow("cannot be empty");
  });

  it("persists documents, chunks, and future embeddings locally in IndexedDB", async () => {
    const ingestion = await ingestTextDocument({
      filename: "evidence.txt",
      mimeType: "text/plain",
      source: "operator-upload",
      content: "KEIRA retains local corpus evidence. Evidence remains inspectable offline.",
    });
    const store = createStore("persistence");

    await store.putDocument(ingestion.document);
    for (const chunk of ingestion.chunks) await store.putChunk(chunk);
    await store.putEmbedding({
      chunkCid: ingestion.chunks[0].cid,
      model: "not-generated",
      modelVersion: "phase-2-placeholder",
      vector: [0.1, 0.2],
      createdAt: ingestion.document.createdAt,
      schemaVersion: "1.0.0",
    });

    expect(await store.listDocuments()).toEqual([ingestion.document]);
    expect(await store.getByCid(ingestion.chunks[0].cid)).toEqual(ingestion.chunks[0]);
    expect(await store.getEmbedding(ingestion.chunks[0].cid)).toMatchObject({ vector: [0.1, 0.2] });
    expect(await store.getStats()).toEqual({ documents: 1, chunks: ingestion.chunks.length, embeddings: 1, storage: "indexeddb", storageBytes: null });
    store.close();
  });

  it("supports deterministic storage inspection and cascading local deletion", async () => {
    const ingestion = await ingestTextDocument({
      filename: "inspection.md",
      mimeType: "text/markdown",
      content: "# Local\nKEIRA uses local corpus storage.\n\n# Policy\nLocal evidence does not grant execution authority.",
    });
    const store = createStore("deletion");
    await store.putDocument(ingestion.document);
    for (const chunk of ingestion.chunks) await store.putChunk(chunk);
    await store.putEmbedding({ chunkCid: ingestion.chunks[0].cid, model: "future-local-model", modelVersion: "unavailable", vector: [], createdAt: ingestion.document.createdAt, schemaVersion: "1.0.0" });

    const matches = await store.search({ query: "local corpus", limit: 10 });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.mode === "storage_lookup" && match.score > 0)).toBe(true);

    await store.deleteDocument(ingestion.document.id);
    expect(await store.listDocuments()).toEqual([]);
    expect(await store.listChunks(ingestion.document.id)).toEqual([]);
    expect(await store.getByCid(ingestion.chunks[0].cid)).toBeUndefined();
    expect(await store.getEmbedding(ingestion.chunks[0].cid)).toBeUndefined();
    expect(await store.getStats()).toEqual({ documents: 0, chunks: 0, embeddings: 0, storage: "indexeddb", storageBytes: null });
    store.close();
  });
});
