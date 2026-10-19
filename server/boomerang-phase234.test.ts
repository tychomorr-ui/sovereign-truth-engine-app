import { describe, expect, it } from "vitest";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import { deriveCryptochromeStartPosition } from "../client/src/lib/boomerang/cryptochrome";
import { localDigestivePass, verifyPharoLapseEnvelope } from "../client/src/lib/boomerang/digestive";
import { runBoomerangSwarm } from "../client/src/lib/boomerang/swarm";
import { traverseAsymmetricReturn, traverseBoomerangAgent } from "../client/src/lib/boomerang/traversal";
import type { ManifoldCandidate } from "../client/src/lib/boomerang/types";

async function fixture(): Promise<ManifoldCandidate[]> {
  const ingestion = await ingestTextDocument({
    filename: "phase234.md",
    mimeType: "text/markdown",
    source: "phase234-test",
    content: "# One\nalpha beta\n# Two\ngamma delta\n# Three\nepsilon zeta\n# Four\neta theta",
    targetTokens: 2,
    overlapTokens: 0,
  });
  return ingestion.chunks.map((artifact, index) => ({
    artifact,
    vector: [Math.cos(index * Math.PI / 4), Math.sin(index * Math.PI / 4), index % 2],
  }));
}

describe("Boomerang Swarm phases 2–4", () => {
  it("derives repeatable, role-distinct cryptochrome starting positions", async () => {
    const literal = await deriveCryptochromeStartPosition("root-signature", "agent-1", "LITERAL", 4);
    const repeat = await deriveCryptochromeStartPosition("root-signature", "agent-1", "LITERAL", 4);
    const contrarian = await deriveCryptochromeStartPosition("root-signature", "agent-1", "CONTRARIAN", 4);
    expect(literal).toEqual(repeat);
    expect(literal).not.toEqual(contrarian);
    expect(Math.sqrt(literal.reduce((sum, value) => sum + value ** 2, 0))).toBeCloseTo(1);
  });

  it("runs an asymmetric return without revisiting outbound artifacts", async () => {
    const candidates = await fixture();
    const initial = traverseBoomerangAgent({ agentId: "agent-1", role: "LITERAL", startPosition: [1, 0, 0], candidates, maxHops: 2, coverageThreshold: 1 });
    const returned = traverseAsymmetricReturn(initial, candidates, 2);
    expect(returned.syntheticReturnVector).not.toBeNull();
    expect(returned.returnHops.every((hop) => !initial.outboundVisitedCids.includes(hop.artifact.cid))).toBe(true);
    expect(returned.visitedCids).toEqual([...returned.outboundVisitedCids, ...returned.returnVisitedCids]);
    expect(new Set(returned.visitedCids).size).toBe(returned.visitedCids.length);
  });

  it("deduplicates digestion and marks the top local-RRF artifact as core", async () => {
    const candidates = await fixture();
    const initial = traverseBoomerangAgent({ agentId: "agent-1", role: "LITERAL", startPosition: [1, 0, 0], candidates, maxHops: 2, coverageThreshold: 1 });
    const returned = traverseAsymmetricReturn(initial, candidates, 2);
    const duplicated = [...returned.hops, returned.hops[0]];
    const digestive = await localDigestivePass("agent-1", duplicated);
    expect(digestive.uniqueArtifacts.length).toBeLessThanOrEqual(duplicated.length);
    expect(digestive.coreCount).toBeGreaterThanOrEqual(1);
    expect(digestive.envelopes.filter((envelope) => envelope.core_flag).length).toBe(digestive.coreCount);
    expect(await verifyPharoLapseEnvelope(digestive.envelopes[0])).toBe(true);
    const tampered = { ...digestive.envelopes[0], local_rrf_score: digestive.envelopes[0].local_rrf_score + 1 };
    expect(await verifyPharoLapseEnvelope(tampered)).toBe(false);
  });

  it("orchestrates three agents and produces verified weighted fusion with a stable root", async () => {
    const candidates = await fixture();
    const first = await runBoomerangSwarm("query-hash-1", "root-signature", candidates, { maxHops: 2, returnMaxHops: 2, coverageThreshold: 1 });
    const second = await runBoomerangSwarm("query-hash-1", "root-signature", candidates, { maxHops: 2, returnMaxHops: 2, coverageThreshold: 1 });
    expect(first.agents).toHaveLength(3);
    expect(first.agents.map((agent) => agent.role)).toEqual(["LITERAL", "CONCEPTUAL", "CONTRARIAN"]);
    expect(first.rejectedEnvelopes).toHaveLength(0);
    expect(first.verifiedEnvelopes.length).toBeGreaterThan(0);
    expect(first.globalFusion.every((item) => item.rank > 0 && item.weightedRrfScore > 0)).toBe(true);
    expect(first.merkleRoot).toBe(second.merkleRoot);
    expect(first.agentSignatureScheme).toBe("SHA-256-INTEGRITY-ONLY");
    expect(first.serverAttestation).toBe("PENDING_SERVER_ED25519");
  });
});
