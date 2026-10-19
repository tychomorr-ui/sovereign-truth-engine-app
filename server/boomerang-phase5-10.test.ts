import { describe, expect, it } from "vitest";
import { runBoomerangSwarm } from "../client/src/lib/boomerang/swarm";
import { canonicalBoomerangAttestationPayload, boomerangResultDigest } from "./boomerang-persistence";
import type { ManifoldCandidate } from "../client/src/lib/boomerang/types";

type Artifact = ManifoldCandidate["artifact"];

function candidates(count: number): ManifoldCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const artifact: Artifact = {
      cid: `bafy-boomerang-${String(index).padStart(3, "0")}`,
      documentId: "phase5-fixture",
      chunkId: `chunk-${index}`,
      content: `deterministic manifold fixture ${index}`,
      metadata: { source: "phase5-10-test", filename: "fixture.md", documentType: "markdown", title: "Fixture", section: null, tags: [], author: null, timestamp: null, role: null, scope: null, keywords: ["fixture"] },
      createdAt: "2026-01-01T00:00:00.000Z",
      sourceHash: `source-${index}`,
      chunkHash: `chunk-hash-${index}`,
      tokenStart: index,
      tokenEnd: index + 4,
      schemaVersion: "1.0.0",
    };
    const angle = index / 5;
    return { artifact, vector: [Math.cos(angle), Math.sin(angle), 1 + (index % 3) * 0.01] };
  });
}

describe("Boomerang Swarm Phases 5–10", () => {
  it("bounds global fusion to the canonical top 30 and launches three roles", async () => {
    const result = await runBoomerangSwarm("query-hash", "root-gate", candidates(40), { maxHops: 4, returnMaxHops: 3 });
    expect(result.schemaVersion).toBe("2.0.0-phase10");
    expect(result.agents).toHaveLength(3);
    expect(result.agents.map((agent) => agent.role)).toEqual(["LITERAL", "CONCEPTUAL", "CONTRARIAN"]);
    expect(result.globalFusion.length).toBeLessThanOrEqual(30);
    expect(result.globalFusion.map((entry) => entry.rank)).toEqual(result.globalFusion.map((_, index) => index + 1));
    expect(result.serverAttestation).toBe("PENDING_SERVER_ED25519");
  });

  it("produces a stable canonical attestation payload and digest", async () => {
    const first = await runBoomerangSwarm("query-hash", "root-gate", candidates(12), { maxHops: 3, returnMaxHops: 2 });
    const second = await runBoomerangSwarm("query-hash", "root-gate", candidates(12), { maxHops: 3, returnMaxHops: 2 });
    expect(canonicalBoomerangAttestationPayload(first)).toBe(canonicalBoomerangAttestationPayload(second));
    expect(boomerangResultDigest(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(boomerangResultDigest(first)).toBe(boomerangResultDigest(second));
  });

  it("does not allow a malformed Phase 10 result into the persistence envelope", () => {
    expect(() => canonicalBoomerangAttestationPayload({
      schemaVersion: "2.0.0-phase10",
      queryHash: "",
      agents: [],
      verifiedEnvelopes: [],
      rejectedEnvelopes: [],
      globalFusion: [],
      merkleRoot: "not-a-root",
      agentSignatureScheme: "SHA-256-INTEGRITY-ONLY",
      serverAttestation: "PENDING_SERVER_ED25519",
    })).toThrow();
  });
});
