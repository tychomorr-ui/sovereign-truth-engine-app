import { describe, expect, it } from "vitest";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import { runBoomerangSwarm } from "../client/src/lib/boomerang/swarm";
import type { ManifoldCandidate } from "../client/src/lib/boomerang/types";
import { verifyBoomerangExport } from "./boomerang-telemetry";

async function resultFixture() {
  const ingestion = await ingestTextDocument({
    filename: "forensic-fixture.md",
    mimeType: "text/markdown",
    source: "telemetry-test",
    content: "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
    targetTokens: 2,
    overlapTokens: 0,
  });
  const candidates: ManifoldCandidate[] = ingestion.chunks.map((artifact, index) => ({
    artifact,
    vector: [Math.cos(index * Math.PI / 4), Math.sin(index * Math.PI / 4), index === 4 ? 1 : 0],
  }));
  return runBoomerangSwarm("query-hash", "corpus-hash", candidates, { maxHops: 4, returnMaxHops: 3 });
}

describe("Boomerang forensic telemetry boundary", () => {
  it("accepts an untouched execution result", async () => {
    const result = await resultFixture();
    const verification = await verifyBoomerangExport({ result, merkleRoot: result.merkleRoot });
    expect(verification).toMatchObject({ accepted: true, status: "VERIFIED" });
  });

  it("rejects trajectory and evidence tampering", async () => {
    const result = await resultFixture();
    const tampered = structuredClone(result);
    tampered.agents[0].hops[0].coverageAfterHop += 0.01;
    const verification = await verifyBoomerangExport({ result: tampered, merkleRoot: result.merkleRoot });
    expect(verification).toMatchObject({ accepted: false, status: "REJECTED" });
    expect(verification.reason).toMatch(/Merkle root mismatch/);
  });

  it("rejects envelope tampering and a directly altered Merkle root", async () => {
    const result = await resultFixture();
    const envelopeTampered = structuredClone(result);
    envelopeTampered.verifiedEnvelopes[0].local_rrf_score += 0.25;
    const envelopeVerification = await verifyBoomerangExport({ result: envelopeTampered, merkleRoot: result.merkleRoot });
    expect(envelopeVerification.status).toBe("REJECTED");

    const rootVerification = await verifyBoomerangExport({ result, merkleRoot: "0".repeat(64) });
    expect(rootVerification).toMatchObject({ accepted: false, status: "REJECTED" });
    expect(rootVerification.reason).toMatch(/Merkle root mismatch/);
  });
});
