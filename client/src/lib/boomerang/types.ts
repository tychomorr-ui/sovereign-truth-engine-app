import type { CorpusArtifact } from "../corpus/types";

export const BOOMERANG_SCHEMA_VERSION = "2.0.0-phase10" as const;
export const BOOMERANG_DEFAULT_MAX_HOPS = 12 as const;
export const BOOMERANG_DEFAULT_COVERAGE_THRESHOLD = 0.7 as const;
export const BOOMERANG_NEIGHBOR_SIMILARITY_THRESHOLD = 0.6 as const;
export const BOOMERANG_CORE_FRACTION = 0.2 as const;
export const BOOMERANG_RRF_CONSTANT = 60 as const;
export const BOOMERANG_AGENT_IDS = ["agent-1", "agent-2", "agent-3"] as const;

export type SwarmAgentRole = "LITERAL" | "CONCEPTUAL" | "CONTRARIAN";
export type SwarmAgentPhase = "LAUNCH" | "OUTBOUND" | "RETURN" | "DIGESTING" | "COMPLETE" | "BLOCKED";
export type HopDirection = "OUTBOUND" | "RETURN";

export type ManifoldCandidate = {
  artifact: CorpusArtifact;
  vector: number[];
};

export type ManifoldHop = {
  hopIndex: number;
  direction: HopDirection;
  artifact: CorpusArtifact;
  similarity: number;
  localCurvatureScore: number;
  traversalScore: number;
  neighborCount: number;
  coverageAfterHop: number;
};

export type PharoLapseEnvelope = {
  artifact_cid: string;
  local_rrf_score: number;
  core_flag: boolean;
  agent_signature: string;
  agent_id: string;
  hop_count: number;
};

export type DigestiveResult = {
  uniqueArtifacts: string[];
  envelopes: PharoLapseEnvelope[];
  coreCount: number;
  peripheralCount: number;
};

export type SwarmAgentState = {
  schemaVersion: typeof BOOMERANG_SCHEMA_VERSION;
  agentId: string;
  role: SwarmAgentRole;
  phase: SwarmAgentPhase;
  position: number[];
  outboundHops: ManifoldHop[];
  returnHops: ManifoldHop[];
  hops: ManifoldHop[];
  visitedCids: string[];
  outboundVisitedCids: string[];
  returnVisitedCids: string[];
  coverage: number;
  maxHops: number;
  coverageThreshold: number;
  syntheticReturnVector: number[] | null;
  digestive: DigestiveResult | null;
  terminationReason: "MAX_HOPS" | "COVERAGE_THRESHOLD" | "NO_UNVISITED_CANDIDATES" | "NO_RETURN_CANDIDATES" | "INVALID_INPUT" | null;
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

export type BoomerangAgentOptions = SwarmTraversalOptions & {
  returnMaxHops?: number;
};

export type GlobalFusionArtifact = {
  artifact: CorpusArtifact;
  weightedRrfScore: number;
  agentIds: string[];
  coreAgentIds: string[];
  envelopeCount: number;
  rank: number;
};

export type BoomerangSwarmResult = {
  schemaVersion: typeof BOOMERANG_SCHEMA_VERSION;
  queryHash: string;
  agents: SwarmAgentState[];
  verifiedEnvelopes: PharoLapseEnvelope[];
  rejectedEnvelopes: Array<{ envelope: PharoLapseEnvelope; reason: string }>;
  globalFusion: GlobalFusionArtifact[];
  merkleRoot: string;
  agentSignatureScheme: "SHA-256-INTEGRITY-ONLY";
  serverAttestation: "PENDING_SERVER_ED25519" | "ED25519_ATTESTED";
  serverSignatureHex?: string;
  serverPubkeyHex?: string;
  serverKeyId?: string;
};

export type PersistedBoomerangTrajectory = BoomerangSwarmResult & {
  trajectoryId: string;
  userId: number;
  createdAt: string | Date;
};
