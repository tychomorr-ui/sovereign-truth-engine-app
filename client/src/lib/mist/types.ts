import type { CorpusArtifact, CorpusEmbeddingIndexResult } from "../corpus/types";

export const MIST_SCHEMA_VERSION = "1.0.0" as const;
export const MIST_RRF_CONSTANT = 60 as const;
export const MIST_LEXICAL_LIMIT = 20 as const;
export const MIST_SEMANTIC_LIMIT = 20 as const;
export const MIST_CLUSTER_COUNT = 3 as const;
export const MIST_ECHO_LIMIT_PER_CENTROID = 3 as const;
export const MIST_ECHO_MIN_SIMILARITY = 0.6 as const;
export const MIST_BRIDGE_MIN_SIMILARITY = 0.2 as const;
export const MIST_PATTERN_LIMIT = 20 as const;
export const MIST_ARCANA_LIMIT = 20 as const;
export const MIST_FUSION_LIMIT = 30 as const;
export const MIST_KMEANS_MAX_ITERATIONS = 12 as const;

export type MistLayerId = "L1_LEXICAL" | "L2_SEMANTIC" | "L3_CENTROID" | "L4_ECHOES" | "L5_PATTERNS" | "L6_ARCANA" | "L7_RRF_FUSION";
export type MistLayerStatus = "EXECUTED" | "EMPTY" | "UNAVAILABLE";
export type MistStatus = "COMPLETE" | "PARTIAL" | "EMPTY_CORPUS";
export type MistFusionSourceLayer = Exclude<MistLayerId, "L7_RRF_FUSION">;

export type MistLayer<T> = {
  id: MistLayerId;
  status: MistLayerStatus;
  candidates: T[];
  reason: string | null;
};

export type MistLexicalCandidate = {
  artifact: CorpusArtifact;
  score: number;
  rank: number;
  matchedTokens: string[];
};

export type MistSemanticCandidate = {
  artifact: CorpusArtifact;
  score: number;
  rank: number;
  model: string;
  modelVersion: string;
};

export type MistCentroid = {
  id: string;
  centroid: number[];
  representative: CorpusArtifact;
  representativeScore: number;
  memberCids: string[];
  memberCount: number;
  rank: number;
};

export type MistEcho = {
  artifact: CorpusArtifact;
  centroidId: string;
  sourceArtifactCid: string;
  similarity: number;
  distance: number;
  layerScore: number;
  rank: number;
};

export type MistPattern = {
  artifact: CorpusArtifact;
  clusterIds: [string, string];
  similarityToClusterA: number;
  similarityToClusterB: number;
  crossClusterRelevance: number;
  bridgeScore: number;
  rank: number;
};

export type MistArcana = {
  artifact: CorpusArtifact;
  matchedMetadata: string[];
  score: number;
  rank: number;
};

export type MistFusionArtifact = {
  artifact: CorpusArtifact;
  layerMemberships: MistFusionSourceLayer[];
  layerRanks: Partial<Record<MistFusionSourceLayer, number>>;
  layerScores: Partial<Record<MistFusionSourceLayer, number>>;
  rrfScore: number;
  rank: number;
};

export type MistFusionResult = {
  id: "L7_RRF_FUSION";
  status: MistLayerStatus;
  rrfConstant: typeof MIST_RRF_CONSTANT;
  candidates: MistFusionArtifact[];
  reason: string | null;
};

export type MistTrajectoryArtifact = {
  artifact: CorpusArtifact;
  layerMemberships: MistFusionSourceLayer[];
  layerScores: Partial<Record<MistFusionSourceLayer, number>>;
  fusionRank: number;
  rrfScore: number;
};

export type MistQuery = {
  raw: string;
  normalized: string;
  tokens: string[];
  hash: string;
  documentId: string | null;
};

export type MistResult = {
  schemaVersion: typeof MIST_SCHEMA_VERSION;
  status: MistStatus;
  query: MistQuery;
  indexing: CorpusEmbeddingIndexResult | null;
  lexical: MistLayer<MistLexicalCandidate>;
  semantic: MistLayer<MistSemanticCandidate>;
  centroid: MistLayer<MistCentroid>;
  echoes: MistLayer<MistEcho>;
  patterns: MistLayer<MistPattern>;
  arcana: MistLayer<MistArcana>;
  fusion: MistFusionResult;
  trajectoryArtifacts: MistTrajectoryArtifact[];
};

/** Canonical external contract name retained for MIST consumers. */
export type MISTResult = MistResult;

export type MistRetrieveOptions = {
  documentId?: string;
};
