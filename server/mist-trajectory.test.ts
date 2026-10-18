import { describe, expect, it } from "vitest";
import type { MistResult, MistTrajectoryArtifact } from "../client/src/lib/mist/types";
import {
  assertPersistableMistResult,
  buildMerkleRoot,
  canonicalJson,
  commitMistTrajectory,
  createMistTrajectoryLeaves,
  sha256Hex,
} from "./mist-trajectory";

function artifact(cid: string, rank: number, score: number): MistTrajectoryArtifact {
  return {
    artifact: {
      cid,
      documentId: `document:${cid}`,
      chunkId: `chunk:${cid}`,
      content: `content ${cid}`,
      metadata: {
        source: "test",
        filename: `${cid}.md`,
        documentType: "markdown",
        title: cid,
        section: "Test",
        tags: ["mist"],
        author: null,
        timestamp: null,
        role: null,
        scope: null,
        keywords: [],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      sourceHash: `source-${cid}`,
      chunkHash: `chunk-${cid}`,
      tokenStart: 0,
      tokenEnd: 2,
      schemaVersion: "1.0.0",
    },
    layerMemberships: ["L5_PATTERNS", "L1_LEXICAL"],
    layerScores: { L1_LEXICAL: 0.5, L5_PATTERNS: score },
    fusionRank: rank,
    rrfScore: score,
  };
}

function result(trajectoryArtifacts: MistTrajectoryArtifact[]): MistResult {
  const emptyLayer = { status: "EMPTY" as const, candidates: [], reason: null };
  return {
    schemaVersion: "1.0.0",
    status: "COMPLETE",
    query: { raw: "alpha", normalized: "alpha", tokens: ["alpha"], hash: "query-hash", documentId: null },
    indexing: null,
    lexical: { id: "L1_LEXICAL", ...emptyLayer },
    semantic: { id: "L2_SEMANTIC", ...emptyLayer },
    centroid: { id: "L3_CENTROID", ...emptyLayer },
    echoes: { id: "L4_ECHOES", ...emptyLayer },
    patterns: { id: "L5_PATTERNS", ...emptyLayer },
    arcana: { id: "L6_ARCANA", ...emptyLayer },
    fusion: { id: "L7_RRF_FUSION", status: "EXECUTED", rrfConstant: 60, candidates: [], reason: null },
    trajectoryArtifacts,
  };
}

describe("durable MIST trajectory Merkle commitments", () => {
  it("canonicalizes object key order and preserves array order", () => {
    expect(canonicalJson({ z: 1, a: { d: 2, c: 3 }, list: ["b", "a"] })).toBe('{"a":{"c":3,"d":2},"list":["b","a"],"z":1}');
  });

  it("duplicates an odd terminal node and produces a stable SHA-256 root", () => {
    const a = sha256Hex("a");
    const b = sha256Hex("b");
    const c = sha256Hex("c");
    const expected = sha256Hex(`${sha256Hex(`${a}${b}`)}${sha256Hex(`${c}${c}`)}`);
    expect(buildMerkleRoot([a, b, c])).toBe(expected);
    expect(buildMerkleRoot([a, b, c])).toBe(buildMerkleRoot([a, b, c]));
  });

  it("commits ordered MIST trajectory leaves and changes the root on payload mutation", () => {
    const first = result([artifact("cid-a", 1, 0.9), artifact("cid-b", 2, 0.4)]);
    const second = result([artifact("cid-a", 1, 0.9), artifact("cid-b", 2, 0.5)]);
    const firstCommitment = commitMistTrajectory(first);
    const secondCommitment = commitMistTrajectory(second);

    expect(createMistTrajectoryLeaves(first.trajectoryArtifacts).map((leaf) => leaf.leafIndex)).toEqual([0, 1]);
    expect(firstCommitment.algorithm).toBe("SHA-256");
    expect(firstCommitment.leafCount).toBe(2);
    expect(firstCommitment.leaves[0].artifactCid).toBe("cid-a");
    expect(firstCommitment.leaves[0].payloadJson).toContain('"fusionRank":1');
    expect(firstCommitment.root).toMatch(/^[a-f0-9]{64}$/);
    expect(firstCommitment.root).not.toBe(secondCommitment.root);
  });

  it("rejects malformed persistence input instead of creating an ungrounded receipt", () => {
    expect(() => assertPersistableMistResult({})).toThrow("not a valid MISTResult");
    expect(() => assertPersistableMistResult(result([{ ...artifact("cid-a", 1, 0.9), rrfScore: Number.NaN }]))).toThrow("invalid trajectory artifact");
  });
});
