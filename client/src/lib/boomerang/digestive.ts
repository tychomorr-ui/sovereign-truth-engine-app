import { canonicalJson, sha256Hex } from "../corpus/ingest";
import {
  BOOMERANG_CORE_FRACTION,
  BOOMERANG_RRF_CONSTANT,
  type DigestiveResult,
  type ManifoldHop,
  type PharoLapseEnvelope,
} from "./types";

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function envelopePayload(envelope: Omit<PharoLapseEnvelope, "agent_signature">): string {
  return canonicalJson(envelope);
}

export async function signPharoLapseEnvelope(envelope: Omit<PharoLapseEnvelope, "agent_signature">): Promise<string> {
  return sha256Hex(envelopePayload(envelope));
}

export async function verifyPharoLapseEnvelope(envelope: PharoLapseEnvelope): Promise<boolean> {
  if (!envelope.agent_id || !envelope.artifact_cid || !envelope.agent_signature) return false;
  return envelope.agent_signature === await signPharoLapseEnvelope({
    artifact_cid: envelope.artifact_cid,
    local_rrf_score: envelope.local_rrf_score,
    core_flag: envelope.core_flag,
    agent_id: envelope.agent_id,
    hop_count: envelope.hop_count,
  });
}

/**
 * Refines an agent haul before it reaches the swarm: deduplicates by CID,
 * computes local reciprocal-rank contribution, and marks the top 20% core.
 */
export async function localDigestivePass(agentId: string, hops: ManifoldHop[]): Promise<DigestiveResult> {
  if (!agentId.trim()) throw new Error("Digestive refinement requires an agent ID.");
  const records = new Map<string, { artifactCid: string; score: number; hopCount: number }>();
  for (const hop of hops) {
    const current = records.get(hop.artifact.cid) ?? { artifactCid: hop.artifact.cid, score: 0, hopCount: 0 };
    current.score += 1 / (BOOMERANG_RRF_CONSTANT + hop.hopIndex + 1);
    current.hopCount += 1;
    records.set(hop.artifact.cid, current);
  }
  const ranked = Array.from(records.values()).sort((left, right) => right.score - left.score || left.artifactCid.localeCompare(right.artifactCid));
  const coreCount = ranked.length ? Math.max(1, Math.ceil(ranked.length * BOOMERANG_CORE_FRACTION)) : 0;
  const envelopes = await Promise.all(ranked.map(async (record, index) => {
    assertFinite(record.score, `local RRF score for ${record.artifactCid}`);
    const unsigned = {
      artifact_cid: record.artifactCid,
      local_rrf_score: record.score,
      core_flag: index < coreCount,
      agent_id: agentId,
      hop_count: record.hopCount,
    } as const;
    return { ...unsigned, agent_signature: await signPharoLapseEnvelope(unsigned) };
  }));
  return {
    uniqueArtifacts: ranked.map((record) => record.artifactCid),
    envelopes,
    coreCount,
    peripheralCount: Math.max(0, envelopes.length - coreCount),
  };
}
