import type { CorpusArtifact } from "../corpus/types";
import {
  BOOMERANG_DEFAULT_COVERAGE_THRESHOLD,
  BOOMERANG_DEFAULT_MAX_HOPS,
  BOOMERANG_NEIGHBOR_SIMILARITY_THRESHOLD,
  type ManifoldCandidate,
  type ManifoldHop,
  type ManifoldHopOptions,
  type SwarmAgentState,
  type SwarmTraversalOptions,
} from "./types";

function assertVector(vector: number[], label: string): void {
  if (!vector.length || !vector.every(Number.isFinite)) {
    throw new Error(`${label} must be a non-empty finite vector.`);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  assertVector(left, "left vector");
  assertVector(right, "right vector");
  if (left.length !== right.length) throw new Error("Manifold vectors must share a dimension.");
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  if (!Number.isFinite(denominator) || denominator <= 0) throw new Error("Manifold vectors must have non-zero magnitude.");
  return dot / denominator;
}

function compareArtifacts(left: CorpusArtifact, right: CorpusArtifact): number {
  return left.cid.localeCompare(right.cid);
}

function validateCandidates(candidates: ManifoldCandidate[]): void {
  if (!candidates.length) throw new Error("Manifold traversal requires at least one candidate.");
  const dimension = candidates[0].vector.length;
  assertVector(candidates[0].vector, "candidate vector");
  const cids = new Set<string>();
  for (const candidate of candidates) {
    assertVector(candidate.vector, `candidate vector for ${candidate.artifact.cid}`);
    if (candidate.vector.length !== dimension) throw new Error("Manifold candidates must share a dimension.");
    if (cids.has(candidate.artifact.cid)) throw new Error(`Manifold candidates contain duplicate CID: ${candidate.artifact.cid}`);
    cids.add(candidate.artifact.cid);
  }
}

/**
 * Select the next manifold landing by cosine similarity multiplied by local
 * neighborhood density. Ties are resolved by CID, never by iteration order.
 */
export function manifoldHop(
  currentPosition: number[],
  candidates: ManifoldCandidate[],
  options: ManifoldHopOptions = {},
): { candidate: ManifoldCandidate; similarity: number; localCurvatureScore: number; traversalScore: number; neighborCount: number } | null {
  assertVector(currentPosition, "current position");
  validateCandidates(candidates);
  const threshold = options.neighborSimilarityThreshold ?? BOOMERANG_NEIGHBOR_SIMILARITY_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) throw new Error("Neighbor similarity threshold must be between -1 and 1.");
  const visited = options.visitedCids ?? new Set<string>();
  const available = candidates.filter((candidate) => !visited.has(candidate.artifact.cid));
  if (!available.length) return null;

  const scored = available.map((candidate) => {
    const similarity = cosineSimilarity(currentPosition, candidate.vector);
    const neighborCount = candidates.filter((neighbor) => {
      if (neighbor.artifact.cid === candidate.artifact.cid) return false;
      return cosineSimilarity(candidate.vector, neighbor.vector) >= threshold;
    }).length;
    const localCurvatureScore = neighborCount / Math.max(1, candidates.length - 1);
    return {
      candidate,
      similarity,
      localCurvatureScore,
      traversalScore: similarity * localCurvatureScore,
      neighborCount,
    };
  });
  return scored.sort((left, right) => (
    right.traversalScore - left.traversalScore
    || right.similarity - left.similarity
    || right.localCurvatureScore - left.localCurvatureScore
    || compareArtifacts(left.candidate.artifact, right.candidate.artifact)
  ))[0] ?? null;
}

export function traverseBoomerangAgent(options: SwarmTraversalOptions): SwarmAgentState {
  const maxHops = options.maxHops ?? BOOMERANG_DEFAULT_MAX_HOPS;
  const coverageThreshold = options.coverageThreshold ?? BOOMERANG_DEFAULT_COVERAGE_THRESHOLD;
  if (!options.agentId.trim()) throw new Error("Swarm agent ID is required.");
  if (!Number.isInteger(maxHops) || maxHops < 1) throw new Error("maxHops must be a positive integer.");
  if (!Number.isFinite(coverageThreshold) || coverageThreshold <= 0 || coverageThreshold > 1) {
    throw new Error("coverageThreshold must be greater than 0 and at most 1.");
  }
  validateCandidates(options.candidates);
  assertVector(options.startPosition, "start position");
  if (options.startPosition.length !== options.candidates[0].vector.length) throw new Error("Start position must match candidate dimension.");

  const state: SwarmAgentState = {
    schemaVersion: "2.0.0-phase1",
    agentId: options.agentId,
    role: options.role,
    phase: "LAUNCH",
    position: [...options.startPosition],
    hops: [],
    visitedCids: [],
    coverage: 0,
    maxHops,
    coverageThreshold,
    terminationReason: null,
  };
  state.phase = "TRAVERSING";
  while (state.hops.length < maxHops && state.coverage < coverageThreshold) {
    const visited = new Set(state.visitedCids);
    const selected = manifoldHop(state.position, options.candidates, {
      visitedCids: visited,
      neighborSimilarityThreshold: options.neighborSimilarityThreshold,
    });
    if (!selected) {
      state.terminationReason = "NO_UNVISITED_CANDIDATES";
      break;
    }
    state.visitedCids.push(selected.candidate.artifact.cid);
    state.coverage = state.visitedCids.length / options.candidates.length;
    state.hops.push({
      hopIndex: state.hops.length,
      artifact: selected.candidate.artifact,
      similarity: selected.similarity,
      localCurvatureScore: selected.localCurvatureScore,
      traversalScore: selected.traversalScore,
      neighborCount: selected.neighborCount,
      coverageAfterHop: state.coverage,
    });
    state.position = [...selected.candidate.vector];
  }
  if (!state.terminationReason) {
    state.terminationReason = state.coverage >= coverageThreshold ? "COVERAGE_THRESHOLD" : "MAX_HOPS";
  }
  state.phase = "COMPLETE";
  return state;
}

export function cosineForManifold(left: number[], right: number[]): number {
  return cosineSimilarity(left, right);
}
