import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "../client/src/lib/corpus/ingest";
import { buildMerkleRoot, verifyStoredMerkleCommitment, type BrowserMerkleCommitment } from "../client/src/lib/mist/commitment";

async function makeCommitment(): Promise<BrowserMerkleCommitment> {
  const payloads = [
    '{"artifact":"alpha"}',
    '{"artifact":"beta"}',
  ];
  const leaves = await Promise.all(payloads.map(async (payloadJson, leafIndex) => ({
    leafIndex,
    artifactCid: `cid:${leafIndex}`,
    leafHash: await sha256Hex(payloadJson),
    payloadJson,
    fusionRank: leafIndex + 1,
    rrfScore: 1 / (leafIndex + 1),
    layerMemberships: ["L1_LEXICAL" as const],
  })));
  return {
    algorithm: "SHA-256",
    leafCount: leaves.length,
    root: await buildMerkleRoot(leaves.map((leaf) => leaf.leafHash)),
    leaves,
  };
}

describe("browser MIST Merkle verification", () => {
  it("verifies an intact stored commitment", async () => {
    const commitment = await makeCommitment();
    await expect(verifyStoredMerkleCommitment(commitment)).resolves.toEqual({
      valid: true,
      reason: "Stored leaves and Merkle root verify.",
    });
  });

  it("rejects a tampered payload or root", async () => {
    const commitment = await makeCommitment();
    const tampered = {
      ...commitment,
      leaves: commitment.leaves.map((leaf, index) => index === 0 ? { ...leaf, payloadJson: canonicalJson({ artifact: "tampered" }) } : leaf),
    };
    await expect(verifyStoredMerkleCommitment(tampered)).resolves.toMatchObject({ valid: false });

    const wrongRoot = { ...commitment, root: "0".repeat(64) };
    await expect(verifyStoredMerkleCommitment(wrongRoot)).resolves.toMatchObject({ valid: false, reason: "Stored leaves do not reproduce the saved Merkle root." });
  });
});
