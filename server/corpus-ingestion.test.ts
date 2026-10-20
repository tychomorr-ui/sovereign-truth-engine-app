import { describe, expect, it } from "vitest";
import { ingestCorpusDocument } from "./corpus-ingestion";
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
    expect(result.embedding.runtime).toBe("server-local");
    expect(result.embeddings[0].vector).toHaveLength(384);
    expect(result.embeddings[0].vector.every(Number.isFinite)).toBe(true);
  });

  it("rejects unsupported document types", async () => {
    await expect(ingestCorpusDocument({ filename: "evidence.pdf", mimeType: "application/pdf" as unknown as "text/plain", content: "not a PDF" })).rejects.toThrow("Only Markdown and plain-text");
  });

  it("filters generic model drift to the exact sovereign response", () => {
    expect(hardLockResponse("How do you work?", "I was trained on a vast amount of text and use a Knowledge Graph with NLP.")).toBe(KEIRA_OUTPUT_FILTER_RESPONSE);
  });
});
