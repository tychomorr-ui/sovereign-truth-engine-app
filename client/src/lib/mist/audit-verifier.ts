import { buildExternalAuditRoot, type ExternalAuditLeaf, type MerkleVerificationReport } from "./commitment";

export type AuditVerificationResult = {
  valid: boolean;
  reason: string;
  timestamp?: string;
  queryHash?: string;
  computedRoot?: string;
};

function hexBytes(value: string): ArrayBuffer {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) throw new Error("Hex value is malformed.");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes.buffer.slice(0) as ArrayBuffer;
}

function isAuditReport(value: unknown): value is MerkleVerificationReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<MerkleVerificationReport>;
  return report.reportType === "KEIRA_MIST_MERKLE_VERIFICATION"
    && report.schemaVersion === "1.0.0"
    && typeof report.saved_merkle_root === "string"
    && typeof report.trajectory_root_cid === "string"
    && Array.isArray(report.audit_leaves)
    && Boolean(report.attestation);
}

export async function verifyAuditReport(value: unknown): Promise<AuditVerificationResult> {
  try {
    if (!isAuditReport(value)) return { valid: false, reason: "Unsupported or incomplete KEIRA audit report." };
    const report = value;
    if (report.trajectory_root_cid !== report.saved_merkle_root) return { valid: false, reason: "Trajectory root CID does not match the saved Merkle root." };
    if (report.attestation?.trajectory_root_cid !== report.trajectory_root_cid) return { valid: false, reason: "Attestation is bound to a different trajectory root." };
    if (report.attestation?.algorithm !== "Ed25519" || report.attestation.encoding !== "hex") return { valid: false, reason: "Unsupported attestation algorithm or encoding." };
    if (!Array.isArray(report.audit_leaves) || report.audit_leaves.length === 0) return { valid: false, reason: "Audit report contains no committed leaves." };

    const ordered = [...report.audit_leaves].sort((left, right) => left.leaf_index - right.leaf_index);
    for (let index = 0; index < ordered.length; index += 1) {
      const leaf = ordered[index];
      if (leaf.leaf_index !== index || typeof leaf.artifact_cid !== "string" || typeof leaf.rank !== "number" || typeof leaf.rrf_score !== "number") {
        return { valid: false, reason: "Audit leaves are malformed or not contiguous." };
      }
    }
    const recomputed = await buildExternalAuditRoot(ordered as ExternalAuditLeaf[]);
    if (recomputed.leaves.some((leaf, index) => leaf.leaf_hash !== report.audit_leaves[index]?.leaf_hash)) return { valid: false, reason: "An audit leaf hash does not match its artifact, rank, and RRF score." };
    if (recomputed.root !== report.saved_merkle_root) return { valid: false, reason: "Recomputed Merkle root does not match the saved root." };

    const publicKey = await crypto.subtle.importKey("raw", hexBytes(report.attestation.pubkey_hex), { name: "Ed25519" }, false, ["verify"]);
    const signatureValid = await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      hexBytes(report.attestation.signature_hex),
      new TextEncoder().encode(report.trajectory_root_cid),
    );
    if (!signatureValid) return { valid: false, reason: "Ed25519 signature verification failed." };

    return {
      valid: true,
      reason: "Merkle root and Ed25519 attestation verified.",
      timestamp: report.generatedAt,
      queryHash: report.trajectory.queryHash,
      computedRoot: recomputed.root,
    };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "Audit report verification failed." };
  }
}
