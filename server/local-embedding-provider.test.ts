import { afterEach, describe, expect, it, vi } from "vitest";
import { generateBatchEmbeddings, generateEmbedding } from "./local-embedding-provider";

afterEach(() => vi.unstubAllGlobals());

describe("server Ollama embedding provider", () => {
  it("returns the embedding from the local endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ embedding: Array.from({ length: 768 }, () => 0.25) }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const embedding = await generateEmbedding("local evidence");
    expect(embedding).toHaveLength(768);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({ model: "nomic-embed-text", prompt: "local evidence" });
  });

  it("rejects empty input and invalid Ollama responses", async () => {
    await expect(generateEmbedding("   ")).rejects.toThrow("cannot be empty");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    await expect(generateEmbedding("invalid response")).rejects.toThrow("invalid embedding format");
  });

  it("surfaces local endpoint failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("offline", { status: 503 })));
    await expect(generateEmbedding("offline query")).rejects.toThrow("Ollama embedding failed: 503");
  });

  it("generates embeddings sequentially for a batch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ embedding: [0.1, 0.2] }), { status: 200 })));
    const embeddings = await generateBatchEmbeddings(["one", "two"]);
    expect(embeddings).toEqual([[0.1, 0.2], [0.1, 0.2]]);
  });
});
