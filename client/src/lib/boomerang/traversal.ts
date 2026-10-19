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
  if (!vector.length || !vector.every(Number.isFinite)) throw new Error(`${label} must be a non-empty finite vector.`);
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
    const neighborCount = candidates.filter((neighbor) => neighbor.artifact.cid !== candidate.artifact.cid
      && cosineSimilarity(candidate.vector, neighbor.vector) >= threshold).length;
    const localCurvatureScore = neighborCount / Math.max(1, candidates.length - 1);
    return { candidate, similarity, localCurvatureScore, traversalScore: similarity * localCurvatureScore, neighborCount };
  });
  return scored.sort((left, right) => (
    right.traversalScore - left.traversalScore
    || right.similarity - left.similarity
    || right.localCurvatureScore - left.localCurvatureScore
    || compareArtifacts(left.candidate.artifact, right.candidate.artifact)
  ))[0] ?? null;
}

function weightedMean(vectors: number[][], weights: number[]): number[] {
  if (!vectors.length || vectors.length !== weights.length) throw new Error("A weighted mean requires matching non-empty vectors and weights.");
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) throw new Error("A weighted mean requires positive total weight.");
  return vectors[0].map((_, dimension) => vectors.reduce((sum, vector, index) => sum + vector[dimension] * weights[index], 0) / totalWeight);
}

function makeHop(index: number, direction: "OUTBOUND" | "RETURN", selected: NonNullable<ReturnType<typeof manifoldHop>>, coverage: number): ManifoldHop {
  return {
    hopIndex: index,
    direction,
    artifact: selected.candidate.artifact,
    similarity: selected.similarity,
    localCurvatureScore: selected.localCurvatureScore,
    traversalScore: selected.traversalScore,
    neighborCount: selected.neighborCount,
    coverageAfterHop: coverage,
  };
}

export function traverseBoomerangAgent(options: SwarmTraversalOptions): SwarmAgentState {
  const maxHops = options.maxHops ?? BOOMERANG_DEFAULT_MAX_HOPS;
  const coverageThreshold = options.coverageThreshold ?? BOOMERANG_DEFAULT_COVERAGE_THRESHOLD;
  if (!options.agentId.trim()) throw new Error("Swarm agent ID is required.");
  if (!Number.isInteger(maxHops) || maxHops < 1) throw new Error("maxHops must be a positive integer.");
  if (!Number.isFinite(coverageThreshold) || coverageThreshold <= 0 || coverageThreshold > 1) throw new Error("coverageThreshold must be greater than 0 and at most 1.");
  validateCandidates(options.candidates);
  assertVector(options.startPosition, "start position");
  if (options.startPosition.length !== options.candidates[0].vector.length) throw new Error("Start position must match candidate dimension.");

  const outboundHops: ManifoldHop[] = [];
  const outboundVisitedCids: string[] = [];
  let position = [...options.startPosition];
  let terminationReason: SwarmAgentState["terminationReason"] = null;
  while (outboundHops.length < maxHops && outboundVisitedCids.length / options.candidates.length < coverageThreshold) {
    const selected = manifoldHop(position, options.candidates, { visitedCids: new Set(outboundVisitedCids), neighborSimilarityThreshold: options.neighborSimilarityThreshold });
    if (!selected) { terminationReason = "NO_UNVISITED_CANDIDATES"; break; }
    outboundVisitedCids.push(selected.candidate.artifact.cid);
    outboundHops.push(makeHop(outboundHops.length, "OUTBOUND", selected, outboundVisitedCids.length / options.candidates.length));
    position = [...selected.candidate.vector];
  }
  if (!terminationReason) terminationReason = outboundVisitedCids.length / options.candidates.length >= coverageThreshold ? "COVERAGE_THRESHOLD" : "MAX_HOPS";
  return {
    schemaVersion: "2.0.0-phase10",
    agentId: options.agentId,
    role: options.role,
    phase: "COMPLETE",
    position,
    outboundHops,
    returnHops: [],
    hops: outboundHops,
    visitedCids: outboundVisitedCids,
    outboundVisitedCids,
    returnVisitedCids: [],
    coverage: outboundVisitedCids.length / options.candidates.length,
    maxHops,
    coverageThreshold,
    syntheticReturnVector: null,
    digestive: null,
    terminationReason,
  };
}

export function syntheticReturnVector(state: SwarmAgentState, candidates: ManifoldCandidate[]): number[] {
  const byCid = new Map(candidates.map((candidate) => [candidate.artifact.cid, candidate]));
  const top = state.outboundHops.slice().sort((left, right) => right.traversalScore - left.traversalScore || left.hopIndex - right.hopIndex).slice(0, 5);
  return weightedMean(top.map((hop) => byCid.get(hop.artifact.cid)?.vector ?? []).filter((vector) => vector.length > 0), top.map((hop) => Math.max(hop.traversalScore, Number.EPSILON)).filter((_, index) => top[index] && byCid.has(top[index].artifact.cid)));
}

export function traverseAsymmetricReturn(state: SwarmAgentState, candidates: ManifoldCandidate[], returnMaxHops = state.maxHops, threshold: number = BOOMERANG_NEIGHBOR_SIMILARITY_THRESHOLD): SwarmAgentState {
  validateCandidates(candidates);
  if (!state.outboundHops.length) throw new Error("Asymmetric return requires at least one outbound hop.");
  const returnVector = syntheticReturnVector(state, candidates);
  const returnHops: ManifoldHop[] = [];
  const returnVisitedCids: string[] = [];
  let position = returnVector;
  while (returnHops.length < returnMaxHops) {
    const selected = manifoldHop(position, candidates, { visitedCids: new Set([...state.outboundVisitedCids, ...returnVisitedCids]), neighborSimilarityThreshold: threshold });
    if (!selected) break;
    returnVisitedCids.push(selected.candidate.artifact.cid);
    returnHops.push(makeHop(returnHops.length, "RETURN", selected, (state.outboundVisitedCids.length + returnVisitedCids.length) / candidates.length));
    position = [...selected.candidate.vector];
  }
  return {
    ...state,
    phase: "COMPLETE",
    position,
    returnHops,
    hops: [...state.outboundHops, ...returnHops],
    visitedCids: [...state.outboundVisitedCids, ...returnVisitedCids],
    returnVisitedCids,
    coverage: Math.min(1, (state.outboundVisitedCids.length + returnVisitedCids.length) / candidates.length),
    syntheticReturnVector: returnVector,
    terminationReason: returnHops.length ? state.terminationReason : "NO_RETURN_CANDIDATES",
  };
}

export function cosineForManifold(left: number[], right: number[]): number {
  return cosineSimilarity(left, right);
}
