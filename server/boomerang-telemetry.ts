import { and, desc, eq } from "drizzle-orm";
import { createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import { keiraBoomerangTelemetry, keiraCorpusVectors, type InsertKeiraBoomerangTelemetry } from "../drizzle/schema";
import type { BoomerangSwarmResult, ManifoldCandidate } from "../client/src/lib/boomerang/types";
import type { CorpusArtifact } from "../client/src/lib/corpus/types";
import { canonicalJson, sha256Hex } from "../client/src/lib/corpus/ingest";
import { getDb } from "./db";
import { persistBoomerangTrajectory } from "./boomerang-persistence";
import { runBoomerangSwarm } from "../client/src/lib/boomerang/swarm";
import { computeBoomerangMerkleRoot } from "../client/src/lib/boomerang/swarm";
import { deriveKeiraKeyId } from "./keira-identity";

type CorpusRow = { userId: number; documentId: string; artifactCid: string; filename: string; content: string; vectorJson: string };

function parseVector(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => Number.isFinite(Number(item))) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function metricsFor(result: BoomerangSwarmResult) {
  const allHops = result.agents.flatMap((agent) => agent.hops);
  const core = new Set(result.agents.flatMap((agent) => agent.digestive?.envelopes.filter((envelope) => envelope.core_flag).map((envelope) => envelope.artifact_cid) ?? []));
  const unique = new Set(allHops.map((hop) => hop.artifact.cid));
  const maxRemaining = Math.max(0, ...result.agents.map((agent) => agent.maxHops - agent.outboundHops.length));
  return {
    hopCount: allHops.length,
    coreEvidenceCount: core.size,
    peripheralEvidenceCount: Math.max(0, unique.size - core.size),
    coverage: result.agents.length ? result.agents.reduce((sum, agent) => sum + agent.coverage, 0) / result.agents.length : 0,
    remainingHops: maxRemaining,
    digestiveSummaryJson: JSON.stringify(result.agents.map((agent) => ({ agentId: agent.agentId, coreCount: agent.digestive?.coreCount ?? 0, peripheralCount: agent.digestive?.peripheralCount ?? 0 }))),
  };
}

export async function persistBoomerangTelemetry(input: {
  userId: number;
  executionId: string;
  trajectoryId?: string;
  corpusId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "COMPLETED" | "FAILED";
  result?: BoomerangSwarmResult;
  errorState?: string;
  totalSwarmLatencyMs?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Boomerang telemetry is unavailable: database is not configured.");
  const result = input.result;
  const metrics = result ? metricsFor(result) : { hopCount: 0, coreEvidenceCount: 0, peripheralEvidenceCount: 0, coverage: 0, remainingHops: 0, digestiveSummaryJson: "[]" };
  const row: InsertKeiraBoomerangTelemetry = {
    executionId: input.executionId,
    userId: input.userId,
    trajectoryId: input.trajectoryId,
    corpusId: input.corpusId,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.completedAt ? input.completedAt.getTime() - input.startedAt.getTime() : null,
    status: input.status,
    agentCount: result?.agents.length ?? 0,
    hopCount: metrics.hopCount,
    convergenceStatus: result?.globalFusion.length ? "CONVERGED" : "NO_CONVERGENCE",
    errorState: input.errorState,
    coreEvidenceCount: metrics.coreEvidenceCount,
    peripheralEvidenceCount: metrics.peripheralEvidenceCount,
    coverage: String(metrics.coverage),
    remainingHops: metrics.remainingHops,
    digestiveSummaryJson: metrics.digestiveSummaryJson,
    fusionStatus: result ? "COMPLETED" : "NOT_RUN",
    merkleRoot: result?.merkleRoot,
    attestationStatus: result?.serverAttestation ?? "UNAVAILABLE",
    verificationStatus: result ? "PENDING_EXTERNAL_VERIFICATION" : "NOT_AVAILABLE",
    envelopeCount: result?.verifiedEnvelopes.length ?? 0,
    rejectedArtifactCount: result?.rejectedEnvelopes.length ?? 0,
    ingestionLatencyMs: null,
    agentProcessingLatencyMs: input.totalSwarmLatencyMs,
    fusionLatencyMs: input.totalSwarmLatencyMs,
    exportLatencyMs: null,
    verificationLatencyMs: null,
    totalSwarmLatencyMs: input.totalSwarmLatencyMs,
    retryCount: 0,
  };
  await db.insert(keiraBoomerangTelemetry).values(row);
}

export async function executeBoomerangForUser(userId: number, query: string): Promise<{ executionId: string; trajectoryId: string; corpusId: string; result: BoomerangSwarmResult }> {
  if (!query.trim()) throw new Error("A Boomerang query is required.");
  const db = await getDb();
  if (!db) throw new Error("Boomerang execution is unavailable: database is not configured.");
  const startedAt = new Date();
  const rows = await db.select().from(keiraCorpusVectors).where(eq(keiraCorpusVectors.userId, userId)) as CorpusRow[];
  const candidates: ManifoldCandidate[] = rows.map((row) => ({
    artifact: {
      cid: row.artifactCid,
      documentId: row.documentId,
      chunkId: row.artifactCid,
      content: row.content,
      metadata: { source: "operator-upload", filename: row.filename, documentType: "text", title: null, section: null, tags: [], author: null, timestamp: null, role: null, scope: null, keywords: [] },
      createdAt: new Date().toISOString(),
      sourceHash: row.artifactCid,
      chunkHash: row.artifactCid,
      tokenStart: 0,
      tokenEnd: row.content.length,
      schemaVersion: "1.0.0",
    } satisfies CorpusArtifact,
    vector: parseVector(row.vectorJson),
  })).filter((candidate) => candidate.vector.length > 0);
  if (!candidates.length) throw new Error("No valid stored corpus vectors are available for this user.");
  const corpusId = await sha256Hex(canonicalJson(rows.map((row) => row.documentId).sort()));
  const executionId = randomUUID();
  try {
    const queryHash = await sha256Hex(query.trim());
    const result = await runBoomerangSwarm(queryHash, corpusId, candidates, { maxHops: 12, returnMaxHops: 12, coverageThreshold: 0.7 });
    const completedAt = new Date();
    const persisted = await persistBoomerangTrajectory(userId, result);
    await persistBoomerangTelemetry({ userId, executionId, trajectoryId: persisted.trajectoryId, corpusId, startedAt, completedAt, status: "COMPLETED", result: persisted, totalSwarmLatencyMs: completedAt.getTime() - startedAt.getTime() });
    return { executionId, trajectoryId: persisted.trajectoryId, corpusId, result: persisted };
  } catch (error) {
    const completedAt = new Date();
    await persistBoomerangTelemetry({ userId, executionId, corpusId, startedAt, completedAt, status: "FAILED", errorState: error instanceof Error ? error.message : "Unknown Boomerang execution failure.", totalSwarmLatencyMs: completedAt.getTime() - startedAt.getTime() }).catch((telemetryError) => console.error("[Boomerang] Failed to persist failure telemetry", telemetryError));
    throw error;
  }
}

export async function listBoomerangTelemetry(userId: number, limit = 24) {
  const db = await getDb();
  if (!db) throw new Error("Boomerang telemetry is unavailable: database is not configured.");
  return db.select().from(keiraBoomerangTelemetry).where(and(eq(keiraBoomerangTelemetry.userId, userId))).orderBy(desc(keiraBoomerangTelemetry.createdAt)).limit(Math.max(1, Math.min(100, Math.floor(limit))));
}

export async function verifyBoomerangExport(input: {
  result: BoomerangSwarmResult;
  merkleRoot: string;
  signatureHex?: string | null;
  pubkeyHex?: string | null;
  keyId?: string | null;
}): Promise<{ accepted: boolean; status: "VERIFIED" | "REJECTED"; reason: string; computedMerkleRoot: string }> {
  const computedMerkleRoot = await computeBoomerangMerkleRoot(input.result);
  if (computedMerkleRoot !== input.merkleRoot || input.result.merkleRoot !== input.merkleRoot) {
    return { accepted: false, status: "REJECTED", reason: "Merkle root mismatch: trajectory or fusion evidence was modified.", computedMerkleRoot };
  }
  for (const envelope of input.result.verifiedEnvelopes) {
    const { agent_signature: signature, ...unsigned } = envelope;
    const expected = await sha256Hex(canonicalJson(unsigned));
    if (signature !== expected) return { accepted: false, status: "REJECTED", reason: `Envelope integrity mismatch for ${envelope.artifact_cid}.`, computedMerkleRoot };
  }
  const hasAnyAttestation = Boolean(input.signatureHex || input.pubkeyHex || input.keyId);
  const hasCompleteAttestation = Boolean(input.signatureHex && input.pubkeyHex && input.keyId);
  if (input.result.serverAttestation === "ED25519_ATTESTED" && !hasCompleteAttestation) {
    return { accepted: false, status: "REJECTED", reason: "Persisted Ed25519 attestation metadata is incomplete.", computedMerkleRoot };
  }
  if (hasAnyAttestation && !hasCompleteAttestation) {
    return { accepted: false, status: "REJECTED", reason: "Ed25519 attestation metadata is incomplete.", computedMerkleRoot };
  }
  if (hasCompleteAttestation) {
    if (typeof input.signatureHex !== "string" || typeof input.pubkeyHex !== "string" || typeof input.keyId !== "string") {
      return { accepted: false, status: "REJECTED", reason: "Ed25519 attestation metadata is incomplete.", computedMerkleRoot };
    }
    try {
      const signatureHex = input.signatureHex;
      const pubkeyHex = input.pubkeyHex;
      const keyId = input.keyId;
      const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
      const publicKey = createPublicKey({ key: Buffer.concat([spkiPrefix, Buffer.from(pubkeyHex, "hex")]), format: "der", type: "spki" });
      if (publicKey.asymmetricKeyType !== "ed25519" || deriveKeiraKeyId(publicKey.export({ type: "spki", format: "pem" }).toString()) !== keyId) {
        return { accepted: false, status: "REJECTED", reason: "Ed25519 key ID is not bound to the attested public key.", computedMerkleRoot };
      }
      if (!verifySignature(null, Buffer.from(input.merkleRoot, "utf8"), publicKey, Buffer.from(signatureHex, "hex"))) {
        return { accepted: false, status: "REJECTED", reason: "Ed25519 attestation signature rejected.", computedMerkleRoot };
      }
    } catch {
      return { accepted: false, status: "REJECTED", reason: "Ed25519 attestation encoding is invalid.", computedMerkleRoot };
    }
  }
  return { accepted: true, status: "VERIFIED", reason: "Trajectory, envelopes, fusion, Merkle root, and available attestation verified.", computedMerkleRoot };
}
