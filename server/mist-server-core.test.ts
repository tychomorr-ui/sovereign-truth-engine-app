import { describe, expect, it } from "vitest";
import { chunkText, computeChunkCid, estimateTokens } from "./corpus-foundation";
import { cosineSimilarity, topKSimilar } from "./corpus-similarity";
import { commitMistResult } from "./mist-commitment";
import type { MistResult } from "./mist-core";

describe("server-side MIST foundation", () => {
  it("chunks deterministically and computes stable CIDs", () => {
    const chunks = chunkText("one two three four five six", 3, 1);
    expect(chunks).toEqual(["one two three", "three four five", "five six"]);
    expect(computeChunkCid(chunks[0])).toHaveLength(64);
    expect(computeChunkCid(chunks[0])).toBe(computeChunkCid(chunks[0]));
    expect(estimateTokens("12345678")).toBe(2);
  });

  it("ranks equal-dimension vectors by cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(topKSimilar([1, 0], [
      { id: "b", embedding: [0, 1] },
      { id: "a", embedding: [1, 0] },
    ], 1)).toEqual([{ id: "a", score: 1 }]);
  });

  it("commits artifact content into a reproducible Merkle root", () => {
    const result: MistResult = {
      query: "local evidence",
      artifacts: [{ cid: "cid-a", content: "evidence", source: "policy.md", layer: 1, score: 0.5 }],
      trajectory_root_cid: "",
      layer_memberships: { 1: ["cid-a"] },
    };
    const first = commitMistResult(result);
    const second = commitMistResult(result);
    expect(first).toEqual(second);
    expect(first.merkle_root).toHaveLength(64);
    expect(first.leaves).toHaveLength(1);
  });
});
