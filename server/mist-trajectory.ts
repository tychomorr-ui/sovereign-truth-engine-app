import { and, desc, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import {
  keiraMistTrajectoryArtifacts,
  keiraMistTrajectories,
  type InsertKeiraMistTrajectory,
  type InsertKeiraMistTrajectoryArtifact,
} from "../drizzle/schema";
import type { MistResult, MistTrajectoryArtifact } from "../client/src/lib/mist/types";
import { getDb } from "./db";

export const MIST_TRAJECTORY_PERSISTENCE_VERSION = "1.0.0" as const;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("MIST trajectory payload contains a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonicalize((value as Record<string, unknown>)[key])])) as JsonValue;
  }
  throw new Error("MIST trajectory payload contains an unsupported value.");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type MistTrajectoryLeaf = {
  leafIndex: number;
  artifactCid: string;
  leafHash: string;
  payloadJson: string;
  fusionRank: number;
  rrfScore: number;
  layerMemberships: MistTrajectoryArtifact["layerMemberships"];
};

export type MistMerkleCommitment = {
  algorithm: "SHA-256";
  leafCount: number;
  root: string;
  leaves: MistTrajectoryLeaf[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertPersistableMistResult(value: unknown): asserts value is MistResult {
  if (!isRecord(value)
    || typeof value.schemaVersion !== "string"
    || !isRecord(value.query)
    || typeof value.query.hash !== "string"
    || typeof value.query.normalized !== "string"
    || !Array.isArray(value.trajectoryArtifacts)
    || !isRecord(value.fusion)
    || typeof value.fusion.rrfConstant !== "number") {
    throw new Error("MIST trajectory payload is not a valid MISTResult.");
  }
  for (const entry of value.trajectoryArtifacts) {
    if (!isRecord(entry) || !isRecord(entry.artifact) || typeof entry.artifact.cid !== "string"
      || !Array.isArray(entry.layerMemberships) || typeof entry.fusionRank !== "number"
      || !Number.isFinite(entry.rrfScore)) {
      throw new Error("MIST trajectory payload contains an invalid trajectory artifact.");
    }
  }
}

function leafPayload(trajectory: MistTrajectoryArtifact): JsonValue {
  return {
    schemaVersion: MIST_TRAJECTORY_PERSISTENCE_VERSION,
    artifact: trajectory.artifact,
    layerMemberships: [...trajectory.layerMemberships].sort(),
    layerScores: trajectory.layerScores,
    fusionRank: trajectory.fusionRank,
    rrfScore: trajectory.rrfScore,
  } as JsonValue;
}

export function createMistTrajectoryLeaves(trajectory: MistTrajectoryArtifact[]): MistTrajectoryLeaf[] {
  return trajectory.map((entry, leafIndex) => {
    const payloadJson = canonicalJson(leafPayload(entry));
    return {
      leafIndex,
      artifactCid: entry.artifact.cid,
      leafHash: sha256Hex(payloadJson),
      payloadJson,
      fusionRank: entry.fusionRank,
      rrfScore: entry.rrfScore,
      layerMemberships: [...entry.layerMemberships].sort() as MistTrajectoryArtifact["layerMemberships"],
    };
  });
}

export function buildMerkleRoot(leafHashes: string[]): string {
  if (!leafHashes.length) return sha256Hex(canonicalJson({ schemaVersion: MIST_TRAJECTORY_PERSISTENCE_VERSION, empty: true }));
  let level = [...leafHashes];
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(sha256Hex(`${left}${right}`));
    }
    level = next;
  }
  return level[0];
}

export function commitMistTrajectory(result: MistResult): MistMerkleCommitment {
  const leaves = createMistTrajectoryLeaves(result.trajectoryArtifacts);
  return { algorithm: "SHA-256", leafCount: leaves.length, root: buildMerkleRoot(leaves.map((leaf) => leaf.leafHash)), leaves };
}

function layerSummary(result: MistResult): string {
  return canonicalJson({
    lexical: { status: result.lexical.status, count: result.lexical.candidates.length },
    semantic: { status: result.semantic.status, count: result.semantic.candidates.length },
    centroid: { status: result.centroid.status, count: result.centroid.candidates.length },
    echoes: { status: result.echoes.status, count: result.echoes.candidates.length },
    patterns: { status: result.patterns.status, count: result.patterns.candidates.length },
    arcana: { status: result.arcana.status, count: result.arcana.candidates.length },
    fusion: { status: result.fusion.status, count: result.fusion.candidates.length },
  });
}

export type PersistedMistTrajectory = {
  trajectoryId: string;
  userId: number;
  schemaVersion: string;
  status: MistResult["status"];
  queryHash: string;
  queryNormalized: string;
  documentId: string | null;
  indexing: MistResult["indexing"];
  layerSummary: Record<string, { status: string; count: number }>;
  merkle: MistMerkleCommitment;
  createdAt: Date;
};

function toPersisted(row: typeof keiraMistTrajectories.$inferSelect, artifacts: typeof keiraMistTrajectoryArtifacts.$inferSelect[]): PersistedMistTrajectory {
  return {
    trajectoryId: row.trajectoryId,
    userId: row.userId,
    schemaVersion: row.schemaVersion,
    status: row.status as MistResult["status"],
    queryHash: row.queryHash,
    queryNormalized: row.queryNormalized,
    documentId: row.documentId,
    indexing: row.indexingJson ? JSON.parse(row.indexingJson) : null,
    layerSummary: JSON.parse(row.layerSummaryJson),
    merkle: {
      algorithm: "SHA-256",
      leafCount: row.leafCount,
      root: row.merkleRoot,
      leaves: artifacts.map((artifact) => ({
        leafIndex: artifact.leafIndex,
        artifactCid: artifact.artifactCid,
        leafHash: artifact.leafHash,
        payloadJson: artifact.payloadJson,
        fusionRank: artifact.fusionRank,
        rrfScore: Number(artifact.rrfScore),
        layerMemberships: JSON.parse(artifact.layerMembershipsJson),
      })),
    },
    createdAt: row.createdAt,
  };
}

export async function persistMistTrajectory(userId: number, result: MistResult): Promise<PersistedMistTrajectory> {
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("MIST trajectory persistence requires a valid user.");
  assertPersistableMistResult(result);
  const db = await getDb();
  if (!db) throw new Error("MIST trajectory persistence is unavailable: database is not configured.");
  const commitment = commitMistTrajectory(result);
  const trajectoryId = randomUUID();
  const createdAt = new Date();
  const trajectoryValues: InsertKeiraMistTrajectory = {
    trajectoryId,
    userId,
    schemaVersion: result.schemaVersion,
    status: result.status,
    queryHash: result.query.hash,
    queryNormalized: result.query.normalized,
    documentId: result.query.documentId,
    indexingJson: result.indexing ? canonicalJson(result.indexing) : null,
    layerSummaryJson: layerSummary(result),
    merkleRoot: commitment.root,
    leafCount: commitment.leafCount,
    rrfConstant: result.fusion.rrfConstant,
    createdAt,
  };
  const artifactValues: InsertKeiraMistTrajectoryArtifact[] = commitment.leaves.map((leaf) => ({
    artifactId: randomUUID(),
    trajectoryId,
    leafIndex: leaf.leafIndex,
    artifactCid: leaf.artifactCid,
    leafHash: leaf.leafHash,
    payloadJson: leaf.payloadJson,
    fusionRank: leaf.fusionRank,
    rrfScore: String(leaf.rrfScore),
    layerMembershipsJson: canonicalJson(leaf.layerMemberships),
    createdAt,
  }));
  await db.transaction(async (transaction) => {
    await transaction.insert(keiraMistTrajectories).values(trajectoryValues);
    if (artifactValues.length) await transaction.insert(keiraMistTrajectoryArtifacts).values(artifactValues);
  });
  return { ...toPersisted(trajectoryValues as typeof keiraMistTrajectories.$inferSelect, artifactValues as typeof keiraMistTrajectoryArtifacts.$inferSelect[]), createdAt };
}

export async function readMistTrajectory(userId: number, trajectoryId: string): Promise<PersistedMistTrajectory | null> {
  const db = await getDb();
  if (!db) throw new Error("MIST trajectory persistence is unavailable: database is not configured.");
  const rows = await db.select().from(keiraMistTrajectories).where(and(eq(keiraMistTrajectories.trajectoryId, trajectoryId), eq(keiraMistTrajectories.userId, userId))).limit(1);
  if (!rows[0]) return null;
  const artifacts = await db.select().from(keiraMistTrajectoryArtifacts).where(eq(keiraMistTrajectoryArtifacts.trajectoryId, trajectoryId)).orderBy(keiraMistTrajectoryArtifacts.leafIndex);
  return toPersisted(rows[0], artifacts);
}

export async function listMistTrajectories(userId: number, limit = 50): Promise<PersistedMistTrajectory[]> {
  const db = await getDb();
  if (!db) throw new Error("MIST trajectory persistence is unavailable: database is not configured.");
  const rows = await db.select().from(keiraMistTrajectories).where(eq(keiraMistTrajectories.userId, userId)).orderBy(desc(keiraMistTrajectories.createdAt)).limit(Math.max(1, Math.min(200, Math.floor(limit))));
  const result: PersistedMistTrajectory[] = [];
  for (const row of rows) {
    const artifacts = await db.select().from(keiraMistTrajectoryArtifacts).where(eq(keiraMistTrajectoryArtifacts.trajectoryId, row.trajectoryId)).orderBy(keiraMistTrajectoryArtifacts.leafIndex);
    result.push(toPersisted(row, artifacts));
  }
  return result;
}
