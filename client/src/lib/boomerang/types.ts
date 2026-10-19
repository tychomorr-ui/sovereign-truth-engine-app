import type { CorpusArtifact } from "../corpus/types";

export const BOOMERANG_SCHEMA_VERSION = "2.0.0-phase1" as const;
export const BOOMERANG_DEFAULT_MAX_HOPS = 12 as const;
export const BOOMERANG_DEFAULT_COVERAGE_THRESHOLD = 0.7 as const;
export const BOOMERANG_NEIGHBOR_SIMILARITY_THRESHOLD = 0.6 as const;

export type SwarmAgentRole = "LITERAL" | "CONCEPTUAL" | "CONTRARIAN";
export type SwarmAgentPhase = "LAUNCH" | "TRAVERSING" | "COMPLETE" | "BLOCKED";

export type ManifoldCandidate = {
  artifact: CorpusArtifact;
  vector: number[];
};

export type ManifoldHop = {
  hopIndex: number;
  artifact: CorpusArtifact;
  similarity: number;
  localCurvatureScore: number;
  traversalScore: number;
  neighborCount: number;
  coverageAfterHop: number;
};

export type SwarmAgentState = {
  schemaVersion: typeof BOOMERANG_SCHEMA_VERSION;
  agentId: string;
  role: SwarmAgentRole;
  phase: SwarmAgentPhase;
  position: number[];
  hops: ManifoldHop[];
  visitedCids: string[];
  coverage: number;
  maxHops: number;
  coverageThreshold: number;
  terminationReason: "MAX_HOPS" | "COVERAGE_THRESHOLD" | "NO_UNVISITED_CANDIDATES" | "INVALID_INPUT" | null;
};

export type ManifoldHopOptions = {
  visitedCids?: ReadonlySet<string>;
  neighborSimilarityThreshold?: number;
};

export type SwarmTraversalOptions = {
  agentId: string;
  role: SwarmAgentRole;
  startPosition: number[];
  candidates: ManifoldCandidate[];
  maxHops?: number;
  coverageThreshold?: number;
  neighborSimilarityThreshold?: number;
};
