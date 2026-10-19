import { generateKeyPairSync } from "node:crypto";
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createMerkleVerificationReport } from "../client/src/lib/mist/commitment";
import { verifyAuditReport } from "../client/src/lib/mist/audit-verifier";
import { signTrajectoryRoot } from "./trajectory-attestation";

const cryptoForTest = webcrypto;

describe("KEIRA external audit verifier", () => {
  it("accepts a valid external Merkle root and Ed25519 attestation", async () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const base = {
      trajectoryId: "trajectory-verify-1",
      status: "COMPLETE",
      queryHash: "query-hash",
      queryNormalized: "verify this trajectory",
      documentId: "document-1",
      createdAt: "2026-10-18T17:00:00.000Z",
      merkle: {
        algorithm: "SHA-256" as const,
        root: "11".repeat(32),
        leafCount: 1,
        leaves: [{ leafIndex: 0, artifactCid: "cid:artifact-1", leafHash: "22".repeat(32), payloadJson: "{}", fusionRank: 1, rrfScore: 1 / 61, layerMemberships: ["L1_LEXICAL"] as const }],
      },
    };
    const unsigned = await createMerkleVerificationReport({ trajectory: base, verification: { status: "verified", message: "verified" } });
    const signature = signTrajectoryRoot(unsigned.trajectory_root_cid, privateKeyPem);
    const report = await createMerkleVerificationReport({
      trajectory: base,
      verification: { status: "verified", message: "verified" },
      attestation: { algorithm: "Ed25519", encoding: "hex", trajectory_root_cid: unsigned.trajectory_root_cid, ...signature, signed_at: "2026-10-18T17:01:00.000Z" },
    });
    Object.defineProperty(globalThis, "crypto", { value: cryptoForTest, configurable: true });

    await expect(verifyAuditReport(report)).resolves.toMatchObject({ valid: true, timestamp: report.generatedAt, queryHash: "query-hash", computedRoot: report.saved_merkle_root });
  });

  it("rejects a changed RRF score even when the signature is unchanged", async () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const base = {
      trajectoryId: "trajectory-verify-2", status: "COMPLETE", queryHash: "query-hash-2", queryNormalized: "tamper check", documentId: null, createdAt: "2026-10-18T17:00:00.000Z",
      merkle: { algorithm: "SHA-256" as const, root: "33".repeat(32), leafCount: 1, leaves: [{ leafIndex: 0, artifactCid: "cid:artifact-2", leafHash: "44".repeat(32), payloadJson: "{}", fusionRank: 1, rrfScore: 1 / 61, layerMemberships: ["L7_RRF_FUSION"] as const }] },
    };
    const unsigned = await createMerkleVerificationReport({ trajectory: base, verification: { status: "verified", message: "verified" } });
    const report = await createMerkleVerificationReport({ trajectory: base, verification: { status: "verified", message: "verified" }, attestation: { algorithm: "Ed25519", encoding: "hex", trajectory_root_cid: unsigned.trajectory_root_cid, ...signTrajectoryRoot(unsigned.trajectory_root_cid, privateKeyPem), signed_at: new Date().toISOString() } });
    report.audit_leaves[0].rrf_score += 0.01;
    await expect(verifyAuditReport(report)).resolves.toMatchObject({ valid: false });
  });
});
