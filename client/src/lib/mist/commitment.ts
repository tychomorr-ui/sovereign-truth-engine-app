import { canonicalJson, sha256Hex } from "../corpus/ingest";
import type { MistResult, MistTrajectoryArtifact } from "./types";

const PERSISTENCE_VERSION = "1.0.0" as const;

type CommitmentLeaf = {
  leafIndex: number;
  artifactCid: string;
  leafHash: string;
  payloadJson: string;
  fusionRank: number;
  rrfScore: number;
  layerMemberships: MistTrajectoryArtifact["layerMemberships"];
};

export type BrowserMerkleCommitment = {
  algorithm: "SHA-256";
  leafCount: number;
  root: string;
  leaves: CommitmentLeaf[];
};

export type MerkleVerificationReport = {
  reportType: "KEIRA_MIST_MERKLE_VERIFICATION";
  schemaVersion: "1.0.0";
  generatedAt: string;
  trajectory_root_cid: string;
  saved_merkle_root: string;
  attestation: {
    algorithm: "Ed25519";
    encoding: "hex";
    trajectory_root_cid: string;
    signature_hex: string;
    pubkey_hex: string;
    signed_at: string;
  } | null;
  verification: {
    status: "verified" | "mismatch" | "unavailable";
    message: string;
    computedRoot: string | null;
  };
  trajectory: {
    trajectoryId: string;
    status: string;
    queryHash: string;
    queryNormalized: string;
    documentId: string | null;
    createdAt: string;
  };
  commitment: {
    algorithm: "SHA-256";
    savedRoot: string;
    leafCount: number;
  };
  leaves: Array<Pick<CommitmentLeaf, "leafIndex" | "artifactCid" | "leafHash" | "fusionRank" | "rrfScore" | "layerMemberships">>;
  audit_leaves: Array<{ leaf_index: number; artifact_cid: string; rank: number; rrf_score: number; leaf_hash: string }>;
};

export type ExternalAuditLeaf = {
  leaf_index: number;
  artifact_cid: string;
  rank: number;
  rrf_score: number;
};

export async function buildExternalAuditRoot(leaves: ExternalAuditLeaf[]): Promise<{ root: string; leaves: Array<ExternalAuditLeaf & { leaf_hash: string }> }> {
  const committedLeaves = await Promise.all([...leaves].sort((left, right) => left.leaf_index - right.leaf_index).map(async (leaf) => ({
    ...leaf,
    leaf_hash: await sha256Hex(canonicalJson({ artifact_cid: leaf.artifact_cid, rank: leaf.rank, rrf_score: leaf.rrf_score })),
  })));
  return { root: await buildMerkleRoot(committedLeaves.map((leaf) => leaf.leaf_hash)), leaves: committedLeaves };
}

export async function createMerkleVerificationReport(input: {
  trajectory: {
    trajectoryId: string;
    status: string;
    queryHash: string;
    queryNormalized: string;
    documentId: string | null;
    createdAt: Date | string;
    merkle: Pick<BrowserMerkleCommitment, "algorithm" | "root" | "leafCount" | "leaves">;
  };
  verification: { status: MerkleVerificationReport["verification"]["status"]; message: string; computedRoot?: string };
  attestation?: MerkleVerificationReport["attestation"];
  generatedAt?: string;
}): Promise<MerkleVerificationReport> {
  const audit = await buildExternalAuditRoot(input.trajectory.merkle.leaves.map((leaf) => ({
    leaf_index: leaf.leafIndex,
    artifact_cid: leaf.artifactCid,
    rank: leaf.fusionRank,
    rrf_score: leaf.rrfScore,
  })));
  return {
    reportType: "KEIRA_MIST_MERKLE_VERIFICATION",
    schemaVersion: "1.0.0",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    trajectory_root_cid: audit.root,
    saved_merkle_root: audit.root,
    attestation: input.attestation ?? null,
    verification: {
      status: input.verification.status,
      message: input.verification.message,
      computedRoot: input.verification.computedRoot ?? null,
    },
    trajectory: {
      trajectoryId: input.trajectory.trajectoryId,
      status: input.trajectory.status,
      queryHash: input.trajectory.queryHash,
      queryNormalized: input.trajectory.queryNormalized,
      documentId: input.trajectory.documentId,
      createdAt: new Date(input.trajectory.createdAt).toISOString(),
    },
    commitment: {
      algorithm: input.trajectory.merkle.algorithm,
      savedRoot: input.trajectory.merkle.root,
      leafCount: input.trajectory.merkle.leafCount,
    },
    leaves: input.trajectory.merkle.leaves.map(({ leafIndex, artifactCid, leafHash, fusionRank, rrfScore, layerMemberships }) => ({
      leafIndex,
      artifactCid,
      leafHash,
      fusionRank,
      rrfScore,
      layerMemberships: [...layerMemberships],
    })),
    audit_leaves: audit.leaves,
  };
}

function leafPayload(trajectory: MistTrajectoryArtifact): unknown {
  return {
    schemaVersion: PERSISTENCE_VERSION,
    artifact: trajectory.artifact,
    layerMemberships: [...trajectory.layerMemberships].sort(),
    layerScores: trajectory.layerScores,
    fusionRank: trajectory.fusionRank,
    rrfScore: trajectory.rrfScore,
  };
}

export async function buildMerkleRoot(leafHashes: string[]): Promise<string> {
  if (!leafHashes.length) return sha256Hex(canonicalJson({ schemaVersion: PERSISTENCE_VERSION, empty: true }));
  let level = [...leafHashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(await sha256Hex(`${left}${right}`));
    }
    level = next;
  }
  return level[0];
}

export async function commitMistTrajectory(result: MistResult): Promise<BrowserMerkleCommitment> {
  const leaves = await Promise.all(result.trajectoryArtifacts.map(async (entry, leafIndex) => {
    const payloadJson = canonicalJson(leafPayload(entry));
    return {
      leafIndex,
      artifactCid: entry.artifact.cid,
      leafHash: await sha256Hex(payloadJson),
      payloadJson,
      fusionRank: entry.fusionRank,
      rrfScore: entry.rrfScore,
      layerMemberships: [...entry.layerMemberships].sort() as MistTrajectoryArtifact["layerMemberships"],
    };
  }));
  return { algorithm: "SHA-256", leafCount: leaves.length, root: await buildMerkleRoot(leaves.map((leaf) => leaf.leafHash)), leaves };
}

export async function verifyStoredMerkleCommitment(commitment: Pick<BrowserMerkleCommitment, "algorithm" | "leafCount" | "root" | "leaves">): Promise<{ valid: boolean; reason: string }> {
  if (commitment.algorithm !== "SHA-256") return { valid: false, reason: "Unsupported commitment algorithm." };
  if (commitment.leafCount !== commitment.leaves.length) return { valid: false, reason: "Leaf count does not match the stored leaves." };

  const orderedLeaves = [...commitment.leaves].sort((left, right) => left.leafIndex - right.leafIndex);
  for (let expectedIndex = 0; expectedIndex < orderedLeaves.length; expectedIndex += 1) {
    const leaf = orderedLeaves[expectedIndex];
    if (leaf.leafIndex !== expectedIndex) return { valid: false, reason: "Stored leaf indexes are not contiguous." };
    if (await sha256Hex(leaf.payloadJson) !== leaf.leafHash) return { valid: false, reason: `Leaf ${expectedIndex + 1} hash does not match its payload.` };
  }

  const root = await buildMerkleRoot(orderedLeaves.map((leaf) => leaf.leafHash));
  return root === commitment.root
    ? { valid: true, reason: "Stored leaves and Merkle root verify." }
    : { valid: false, reason: "Stored leaves do not reproduce the saved Merkle root." };
}
