import { createHash } from "node:crypto";
import { runMist, type MistResult } from "./mist-core";
import type { CorpusArtifact } from "../client/src/lib/corpus/types";
import type { MistFusionSourceLayer, MistResult as PersistableMistResult } from "../client/src/lib/mist/types";

const LAYER_IDS: MistFusionSourceLayer[] = ["L1_LEXICAL", "L2_SEMANTIC", "L3_CENTROID", "L4_ECHOES", "L5_PATTERNS", "L6_ARCANA"];
type ServerMistArtifact = MistResult["artifacts"][number];

function toCorpusArtifact(artifact: ServerMistArtifact, index: number): CorpusArtifact {
  const now = new Date().toISOString();
  return {
    cid: artifact.cid,
    documentId: "server-corpus",
    chunkId: `server-${index}`,
    content: artifact.content,
    metadata: { source: "server-corpus", filename: artifact.source, documentType: artifact.source.toLowerCase().endsWith(".md") ? "markdown" : "text", title: null, section: null, tags: [], author: null, timestamp: null, role: null, scope: null, keywords: [] },
    createdAt: now,
    sourceHash: artifact.cid,
    chunkHash: artifact.cid,
    tokenStart: 0,
    tokenEnd: artifact.content.length,
    schemaVersion: "1.0.0",
  };
}

export function toPersistableMistResult(result: MistResult): PersistableMistResult {
  const artifacts = result.artifacts.map(toCorpusArtifact);
  const membershipsFor = (cid: string): MistFusionSourceLayer[] => LAYER_IDS.filter((layer, index) => result.layer_memberships[index + 1]?.includes(cid) ?? false);
  const status = result.artifacts.length ? "EXECUTED" : "EMPTY";
  const emptyLayer = (id: string) => ({ id, status, candidates: [], reason: result.artifacts.length ? null : "No server corpus artifacts matched." });
  const trajectoryArtifacts = artifacts.map((artifact, index) => ({ artifact, layerMemberships: membershipsFor(artifact.cid), layerScores: {}, fusionRank: index + 1, rrfScore: result.artifacts[index]?.score ?? 0 }));
  const queryNormalized = result.query.trim().toLowerCase();
  return {
    schemaVersion: "1.0.0",
    status: result.artifacts.length ? "COMPLETE" : "EMPTY_CORPUS",
    query: { raw: result.query, normalized: queryNormalized, tokens: queryNormalized.match(/[a-z0-9_]+/g) ?? [], hash: createHash("sha256").update(queryNormalized).digest("hex"), documentId: null },
    indexing: null,
    lexical: emptyLayer("L1_LEXICAL") as PersistableMistResult["lexical"],
    semantic: emptyLayer("L2_SEMANTIC") as PersistableMistResult["semantic"],
    centroid: emptyLayer("L3_CENTROID") as PersistableMistResult["centroid"],
    echoes: emptyLayer("L4_ECHOES") as PersistableMistResult["echoes"],
    patterns: emptyLayer("L5_PATTERNS") as PersistableMistResult["patterns"],
    arcana: emptyLayer("L6_ARCANA") as PersistableMistResult["arcana"],
    fusion: { id: "L7_RRF_FUSION", status, rrfConstant: 60, candidates: trajectoryArtifacts.map((entry) => ({ artifact: entry.artifact, layerMemberships: entry.layerMemberships, layerRanks: {}, layerScores: {}, rrfScore: entry.rrfScore, rank: entry.fusionRank })), reason: result.artifacts.length ? null : "No server corpus artifacts matched." },
    trajectoryArtifacts,
  } as PersistableMistResult;
}

export async function retrieveForChat(userId: number, query: string): Promise<{ result: MistResult; artifacts: MistResult["artifacts"]; trajectory_root_cid: string }> {
  const result = await runMist(query, { userId, maxArtifacts: 30 });
  console.info(`[MIST] chat retrieval user=${userId} trajectory_root_cid=${result.trajectory_root_cid || "EMPTY"} artifacts=${result.artifacts.length}`);
  return { result, artifacts: result.artifacts, trajectory_root_cid: result.trajectory_root_cid };
}

export function formatMistArtifactsForPrompt(artifacts: MistResult["artifacts"]): string {
  if (!artifacts.length) return "EVIDENCE ARTIFACTS:\n[UNRESOLVED] No MIST artifacts were retrieved.";
  return ["EVIDENCE ARTIFACTS:", ...artifacts.map((artifact) => `[CID: ${artifact.cid}] ${artifact.content}`)].join("\n");
}
