import { describe, expect, it } from "vitest";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import { manifoldHop, traverseBoomerangAgent } from "../client/src/lib/boomerang/traversal";
import type { ManifoldCandidate } from "../client/src/lib/boomerang/types";

async function candidates() {
  const ingestion = await ingestTextDocument({
    filename: "boomerang-fixture.md",
    mimeType: "text/markdown",
    source: "phase1-test",
    content: "# Fixture\nalpha beta gamma delta epsilon zeta eta theta",
    targetTokens: 2,
    overlapTokens: 0,
  });
  return ingestion.chunks.map((artifact, index) => ({
    artifact,
    vector: [Math.cos(index * Math.PI / 4), Math.sin(index * Math.PI / 4), index === 4 ? 1 : 0],
  }));
}

describe("Boomerang Swarm Phase 1", () => {
  it("selects a manifold landing using similarity multiplied by local curvature", async () => {
    const fixture = await candidates();
    const current = [1, 0, 0];
    const isolated = { ...fixture[0], vector: [0.99, 0.1, 0] };
    const denseA = { ...fixture[1], vector: [0.85, 0.53, 0] };
    const denseB = { ...fixture[2], vector: [0.86, 0.51, 0.01] };
    const denseC = { ...fixture[3], vector: [0.84, 0.54, -0.01] };
    const result = manifoldHop(current, [isolated, denseA, denseB, denseC], { neighborSimilarityThreshold: 0.99 });

    expect(result).not.toBeNull();
    expect([denseA, denseB, denseC].map((candidate) => candidate.artifact.cid)).toContain(result?.candidate.artifact.cid);
    expect(result?.neighborCount).toBeGreaterThanOrEqual(2);
    expect(result?.localCurvatureScore).toBeGreaterThan(0);
    expect(result?.traversalScore).toBeCloseTo((result?.similarity ?? 0) * (result?.localCurvatureScore ?? 0));
  });

  it("produces bounded, deterministic paths and stops at coverage threshold", async () => {
    const fixture = await candidates();
    const options = {
      agentId: "agent-literal",
      role: "LITERAL" as const,
      startPosition: [1, 0, 0],
      candidates: fixture,
      maxHops: 12,
      coverageThreshold: 0.7,
    };
    const first = traverseBoomerangAgent(options);
    const second = traverseBoomerangAgent(options);

    expect(first).toEqual(second);
    expect(first.phase).toBe("COMPLETE");
    expect(first.terminationReason).toBe("COVERAGE_THRESHOLD");
    expect(first.coverage).toBeGreaterThanOrEqual(0.7);
    expect(first.hops.length).toBeLessThanOrEqual(12);
    expect(new Set(first.visitedCids).size).toBe(first.visitedCids.length);
    expect(first.hops.map((hop) => hop.artifact.cid)).toEqual(first.visitedCids);
  });

  it("supports three deterministic agent paths without a fixed MIST layer order", async () => {
    const fixture = await candidates();
    const starts: Array<[string, "LITERAL" | "CONCEPTUAL" | "CONTRARIAN", number[]]> = [
      ["agent-1", "LITERAL", [1, 0, 0]],
      ["agent-2", "CONCEPTUAL", [0, 1, 0]],
      ["agent-3", "CONTRARIAN", [-1, 0, 0]],
    ];
    const paths = starts.map(([agentId, role, startPosition]) => traverseBoomerangAgent({
      agentId,
      role,
      startPosition,
      candidates: fixture,
      maxHops: 3,
      coverageThreshold: 1,
    }).visitedCids.join("|"));

    expect(new Set(paths).size).toBe(3);
    expect(paths.every((path) => path.length > 0)).toBe(true);
  });

  it("fails closed on duplicate candidates and invalid traversal bounds", async () => {
    const fixture = await candidates();
    expect(() => manifoldHop([1, 0, 0], [fixture[0], fixture[0]])).toThrow(/duplicate CID/);
    expect(() => traverseBoomerangAgent({
      agentId: "invalid",
      role: "LITERAL",
      startPosition: [1, 0, 0],
      candidates: fixture,
      maxHops: 0,
    })).toThrow(/maxHops/);
  });
});
