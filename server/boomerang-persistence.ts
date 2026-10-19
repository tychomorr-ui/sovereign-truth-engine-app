import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { keiraBoomerangTrajectories, type InsertKeiraBoomerangTrajectory } from "../drizzle/schema";
import type { BoomerangSwarmResult, PersistedBoomerangTrajectory } from "../client/src/lib/boomerang/types";
import { getDb } from "./db";
import { signWithKeiraIdentityKey } from "./keira-identity-persistence";
import { canonicalJson, sha256Hex } from "./mist-trajectory";

function assertBoomerangResult(value: unknown): asserts value is BoomerangSwarmResult {
  if (!value || typeof value !== "object") throw new Error("Boomerang result must be an object.");
  const result = value as Record<string, unknown>;
  if (result.schemaVersion !== "2.0.0-phase10" || typeof result.queryHash !== "string" || !result.queryHash.trim()
    || typeof result.merkleRoot !== "string" || !/^[a-f0-9]{64}$/i.test(result.merkleRoot)
    || !Array.isArray(result.agents) || !Array.isArray(result.globalFusion)) {
    throw new Error("Boomerang result failed the Phase 10 persistence contract.");
  }
  if (result.globalFusion.length > 30) throw new Error("Boomerang global fusion exceeds the canonical top-30 limit.");
}

export function canonicalBoomerangAttestationPayload(result: BoomerangSwarmResult): string {
  assertBoomerangResult(result);
  return canonicalJson({ schemaVersion: result.schemaVersion, queryHash: result.queryHash, merkleRoot: result.merkleRoot });
}

export function boomerangResultDigest(result: BoomerangSwarmResult): string {
  return sha256Hex(canonicalBoomerangAttestationPayload(result));
}

function fromRow(row: typeof keiraBoomerangTrajectories.$inferSelect): PersistedBoomerangTrajectory {
  const result = JSON.parse(row.resultJson) as BoomerangSwarmResult;
  return {
    ...result,
    trajectoryId: row.trajectoryId,
    userId: row.userId,
    createdAt: row.createdAt,
    serverAttestation: row.signatureHex && row.pubkeyHex ? "ED25519_ATTESTED" : result.serverAttestation,
    serverSignatureHex: row.signatureHex ?? undefined,
    serverPubkeyHex: row.pubkeyHex ?? undefined,
    serverKeyId: row.keyId ?? undefined,
  };
}

export async function persistBoomerangTrajectory(userId: number, result: BoomerangSwarmResult): Promise<PersistedBoomerangTrajectory> {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Boomerang persistence requires a valid user.");
  assertBoomerangResult(result);
  const db = await getDb();
  if (!db) throw new Error("Boomerang persistence is unavailable: database is not configured.");
  const attestation = await signWithKeiraIdentityKey(result.merkleRoot);
  const trajectoryId = randomUUID();
  const createdAt = new Date();
  const stored: InsertKeiraBoomerangTrajectory = {
    trajectoryId,
    userId,
    schemaVersion: result.schemaVersion,
    queryHash: result.queryHash,
    merkleRoot: result.merkleRoot,
    resultJson: JSON.stringify({ ...result, serverAttestation: "ED25519_ATTESTED", serverSignatureHex: attestation.signature_hex, serverPubkeyHex: attestation.pubkey_hex, serverKeyId: attestation.key_id }),
    attestationAlgorithm: "Ed25519",
    signatureHex: attestation.signature_hex,
    pubkeyHex: attestation.pubkey_hex,
    keyId: attestation.key_id,
    createdAt,
  };
  await db.insert(keiraBoomerangTrajectories).values(stored);
  return fromRow(stored as typeof keiraBoomerangTrajectories.$inferSelect);
}

export async function readBoomerangTrajectory(userId: number, trajectoryId: string) {
  const db = await getDb();
  if (!db) throw new Error("Boomerang persistence is unavailable: database is not configured.");
  const rows = await db.select().from(keiraBoomerangTrajectories).where(and(eq(keiraBoomerangTrajectories.userId, userId), eq(keiraBoomerangTrajectories.trajectoryId, trajectoryId))).limit(1);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listBoomerangTrajectories(userId: number, limit = 24) {
  const db = await getDb();
  if (!db) throw new Error("Boomerang persistence is unavailable: database is not configured.");
  const rows = await db.select().from(keiraBoomerangTrajectories).where(eq(keiraBoomerangTrajectories.userId, userId)).orderBy(desc(keiraBoomerangTrajectories.createdAt)).limit(Math.max(1, Math.min(100, Math.floor(limit))));
  return rows.map(fromRow);
}
