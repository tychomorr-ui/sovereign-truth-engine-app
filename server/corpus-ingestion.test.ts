import { describe, expect, it, vi } from "vitest";

vi.mock("./local-embedding-provider", () => ({
  generateEmbedding: vi.fn(async (text: string) => Array.from({ length: 768 }, (_, index) => (text.length + (index % 7)) / 1000)),
}));

import { ingestCorpusDocument, searchStoredCorpusEvidence } from "./corpus-ingestion";
import { KEIRA_OUTPUT_FILTER_RESPONSE, hardLockResponse } from "./keira-prompt";

describe("Portal corpus ingestion", () => {
  it("chunks supported text and returns finite local vectors", async () => {
    const result = await ingestCorpusDocument({
      filename: "policy.md",
      mimeType: "text/markdown",
      content: "# Local policy\n\nKEIRA retrieves evidence locally.\n\n# Authority\n\nCapability is not authority.",
    });
    expect(result.document.metadata.filename).toBe("policy.md");
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.embeddings).toHaveLength(result.chunks.length);
    expect(result.embedding.model).toBe("nomic-embed-text");
    expect(result.embedding.modelVersion).toBe("1.0");
    expect(result.embedding.runtime).toBe("ollama");
    expect(result.embeddings[0].vector).toHaveLength(768);
    expect(result.embeddings[0].vector.every(Number.isFinite)).toBe(true);
  });

  it("stores 768-dimensional vectors for each ingested chunk", async () => {
    const result = await ingestCorpusDocument({
      filename: "dimension-check.txt",
      mimeType: "text/plain",
      content: "The MIST corpus uses aligned local embedding dimensions.",
    });
    const vectorJson = JSON.stringify(result.embeddings[0].vector);
    expect(JSON.parse(vectorJson)).toHaveLength(768);
  });

  it("rejects unsupported document types", async () => {
    await expect(ingestCorpusDocument({ filename: "evidence.pdf", mimeType: "application/pdf" as unknown as "text/plain", content: "not a PDF" })).rejects.toThrow("Only Markdown and plain-text");
  });

  it("can retrieve evidence from the server-local vector fallback", async () => {
    await ingestCorpusDocument({
      filename: "runtime.txt",
      mimeType: "text/plain",
      content: "The local runtime uses deterministic evidence retrieval through the MIST mesh.",
    }, 987654321);
    const evidence = await searchStoredCorpusEvidence(987654321, "deterministic evidence retrieval");
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence[0].snippet).toContain("deterministic evidence retrieval");
  });

  it("filters generic model drift to the exact sovereign response", () => {
    expect(hardLockResponse("How do you work?", "I was trained on a vast amount of text and use a Knowledge Graph with NLP.")).toBe(KEIRA_OUTPUT_FILTER_RESPONSE);
  });
});
