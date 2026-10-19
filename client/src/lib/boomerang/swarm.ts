import { canonicalJson, sha256Hex } from "../corpus/ingest";
import { deriveCryptochromeStartPosition } from "./cryptochrome";
import { localDigestivePass, verifyPharoLapseEnvelope } from "./digestive";
import { traverseAsymmetricReturn, traverseBoomerangAgent } from "./traversal";
import {
  BOOMERANG_AGENT_IDS,
  BOOMERANG_RRF_CONSTANT,
  type BoomerangAgentOptions,
  type BoomerangSwarmResult,
  type GlobalFusionArtifact,
  type ManifoldCandidate,
  type PharoLapseEnvelope,
  type SwarmAgentRole,
} from "./types";

const AGENT_ROLES: Record<string, SwarmAgentRole> = {
  "agent-1": "LITERAL",
  "agent-2": "CONCEPTUAL",
  "agent-3": "CONTRARIAN",
};

const ROLE_WEIGHTS: Record<SwarmAgentRole, number> = {
  LITERAL: 1,
  CONCEPTUAL: 1.1,
  CONTRARIAN: 0.9,
};

function merkleLayer(hashes: string[]): string[] {
  const next: string[] = [];
  for (let index = 0; index < hashes.length; index += 2) next.push(hashes[index + 1] ? `${hashes[index]}${hashes[index + 1]}` : `${hashes[index]}${hashes[index]}`);
  return next;
}

async function merkleRoot(values: unknown[]): Promise<string> {
  if (!values.length) return sha256Hex(canonicalJson({ empty: true }));
  let hashes = await Promise.all(values.map((value) => sha256Hex(canonicalJson(value))));
  while (hashes.length > 1) hashes = await Promise.all(merkleLayer(hashes).map((value) => sha256Hex(value)));
  return hashes[0];
}

function assertCandidateMap(candidates: ManifoldCandidate[]): Map<string, ManifoldCandidate> {
  const map = new Map<string, ManifoldCandidate>();
  for (const candidate of candidates) {
    if (map.has(candidate.artifact.cid)) throw new Error(`Duplicate candidate CID: ${candidate.artifact.cid}`);
    map.set(candidate.artifact.cid, candidate);
  }
  return map;
}

export type BoomerangSwarmOptions = Omit<Partial<BoomerangAgentOptions>, "agentId" | "role" | "startPosition" | "candidates"> & {
  maxAgents?: number;
};

export async function runBoomerangSwarm(
  queryHash: string,
  rootGateSignature: string,
  candidates: ManifoldCandidate[],
  options: BoomerangSwarmOptions = {},
): Promise<BoomerangSwarmResult> {
  if (!queryHash.trim()) throw new Error("A query hash is required for Boomerang orchestration.");
  if (!candidates.length) throw new Error("Boomerang orchestration requires corpus candidates.");
  const candidateMap = assertCandidateMap(candidates);
  const dimension = candidates[0].vector.length;
  const agentIds = BOOMERANG_AGENT_IDS.slice(0, Math.max(1, Math.min(3, options.maxAgents ?? 3)));
  const agents = [];
  const envelopes: PharoLapseEnvelope[] = [];

  for (const agentId of agentIds) {
    const role = AGENT_ROLES[agentId];
    const startPosition = await deriveCryptochromeStartPosition(rootGateSignature, agentId, role, dimension);
    const initial = traverseBoomerangAgent({
      agentId,
      role,
      startPosition,
      candidates,
      maxHops: options.maxHops,
      coverageThreshold: options.coverageThreshold,
      neighborSimilarityThreshold: options.neighborSimilarityThreshold,
    });
    const returned = traverseAsymmetricReturn(initial, candidates, options.returnMaxHops, options.neighborSimilarityThreshold);
    const digestive = await localDigestivePass(agentId, returned.hops);
    returned.phase = "COMPLETE";
    returned.digestive = digestive;
    agents.push(returned);
    envelopes.push(...digestive.envelopes);
  }

  const verifiedEnvelopes: PharoLapseEnvelope[] = [];
  const rejectedEnvelopes: Array<{ envelope: PharoLapseEnvelope; reason: string }> = [];
  for (const envelope of envelopes) {
    if (await verifyPharoLapseEnvelope(envelope)) verifiedEnvelopes.push(envelope);
    else rejectedEnvelopes.push({ envelope, reason: "SHA-256 integrity signature mismatch" });
  }

  const aggregate = new Map<string, { score: number; agentIds: Set<string>; coreAgentIds: Set<string>; envelopeCount: number }>();
  for (const envelope of verifiedEnvelopes) {
    const current = aggregate.get(envelope.artifact_cid) ?? { score: 0, agentIds: new Set<string>(), coreAgentIds: new Set<string>(), envelopeCount: 0 };
    current.score += envelope.local_rrf_score * ROLE_WEIGHTS[agents.find((agent) => agent.agentId === envelope.agent_id)?.role ?? "LITERAL"] * (envelope.core_flag ? 2 : 1);
    current.agentIds.add(envelope.agent_id);
    if (envelope.core_flag) current.coreAgentIds.add(envelope.agent_id);
    current.envelopeCount += 1;
    aggregate.set(envelope.artifact_cid, current);
  }
  const globalFusion: GlobalFusionArtifact[] = Array.from(aggregate.entries())
    .map(([artifactCid, value]) => ({ artifact: candidateMap.get(artifactCid)!.artifact, weightedRrfScore: value.score / (BOOMERANG_RRF_CONSTANT + value.envelopeCount), agentIds: Array.from(value.agentIds).sort(), coreAgentIds: Array.from(value.coreAgentIds).sort(), envelopeCount: value.envelopeCount, rank: 0 }))
    .sort((left, right) => right.weightedRrfScore - left.weightedRrfScore || left.artifact.cid.localeCompare(right.artifact.cid))
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const root = await merkleRoot(globalFusion.map((item) => ({ artifact_cid: item.artifact.cid, rank: item.rank, weighted_rrf_score: item.weightedRrfScore })));

  return {
    schemaVersion: "2.0.0-phase4",
    queryHash,
    agents,
    verifiedEnvelopes,
    rejectedEnvelopes,
    globalFusion,
    merkleRoot: root,
    agentSignatureScheme: "SHA-256-INTEGRITY-ONLY",
    serverAttestation: "PENDING_SERVER_ED25519",
  };
}
