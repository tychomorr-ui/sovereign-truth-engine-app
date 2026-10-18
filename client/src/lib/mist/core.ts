import { canonicalJson, normalizeCorpusText, sha256Hex } from "../corpus/ingest";
import { LocalCorpusSimilarityService } from "../corpus/local-similarity";
import type { CorpusArtifact, CorpusEmbedding } from "../corpus/types";
import type { EmbeddingProvider } from "../embedding/types";
import type { CorpusStore } from "../storage/interface";
import {
  MIST_ARCANA_LIMIT,
  MIST_BRIDGE_MIN_SIMILARITY,
  MIST_CLUSTER_COUNT,
  MIST_ECHO_LIMIT_PER_CENTROID,
  MIST_ECHO_MIN_SIMILARITY,
  MIST_FUSION_LIMIT,
  MIST_KMEANS_MAX_ITERATIONS,
  MIST_LEXICAL_LIMIT,
  MIST_PATTERN_LIMIT,
  MIST_RRF_CONSTANT,
  MIST_SCHEMA_VERSION,
  MIST_SEMANTIC_LIMIT,
  type MistArcana,
  type MistCentroid,
  type MistEcho,
  type MistFusionArtifact,
  type MistFusionResult,
  type MistFusionSourceLayer,
  type MistLayer,
  type MistLayerId,
  type MistLexicalCandidate,
  type MistPattern,
  type MistQuery,
  type MistResult,
  type MistRetrieveOptions,
  type MistSemanticCandidate,
  type MistStatus,
} from "./types";

type VectorCandidate = {
  semantic: MistSemanticCandidate;
  vector: number[];
};

type Cluster = {
  id: string;
  vector: number[];
  members: VectorCandidate[];
};

type FusionInput = {
  layer: MistFusionSourceLayer;
  artifact: CorpusArtifact;
  score: number;
  rank: number;
};

function mistTokens(value: string): string[] {
  const normalized = normalizeCorpusText(value)
    .toLocaleLowerCase()
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
  return Array.from(new Set(normalized ? normalized.split(/\s+/) : []));
}

function compareArtifacts(left: CorpusArtifact, right: CorpusArtifact): number {
  return left.cid.localeCompare(right.cid);
}

function rank<T extends { score: number; artifact: CorpusArtifact }>(candidates: T[], limit: number): Array<T & { rank: number }> {
  return candidates
    .sort((left, right) => right.score - left.score || compareArtifacts(left.artifact, right.artifact))
    .slice(0, limit)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function emptyLayer<T>(id: MistLayerId, status: "EMPTY" | "UNAVAILABLE", reason: string | null): MistLayer<T> {
  return { id, status, candidates: [], reason };
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0 || !left.every(Number.isFinite) || !right.every(Number.isFinite)) {
    throw new Error("MIST cosine similarity requires equal-length finite vectors.");
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  if (!Number.isFinite(denominator) || denominator <= 0) throw new Error("MIST cosine similarity requires non-zero vectors.");
  return dot / denominator;
}

function centroid(vectors: number[][]): number[] {
  if (!vectors.length) throw new Error("A centroid requires at least one vector.");
  const dimension = vectors[0].length;
  if (!dimension || vectors.some((vector) => vector.length !== dimension || !vector.every(Number.isFinite))) {
    throw new Error("MIST centroid inputs must have one finite shared dimension.");
  }
  return Array.from({ length: dimension }, (_, dimensionIndex) => (
    vectors.reduce((sum, vector) => sum + vector[dimensionIndex], 0) / vectors.length
  ));
}

function squaredDistance(left: number[], right: number[]): number {
  if (left.length !== right.length) throw new Error("MIST distance requires equal-length vectors.");
  return left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0);
}

function chooseSeedCandidates(candidates: VectorCandidate[], count: number): VectorCandidate[] {
  if (!candidates.length || count < 1) return [];
  const seeds = [candidates[0]];
  while (seeds.length < count) {
    const selected = candidates
      .filter((candidate) => !seeds.some((seed) => seed.semantic.artifact.cid === candidate.semantic.artifact.cid))
      .map((candidate) => ({
        candidate,
        distance: Math.min(...seeds.map((seed) => squaredDistance(candidate.vector, seed.vector))),
      }))
      .sort((left, right) => right.distance - left.distance || compareArtifacts(left.candidate.semantic.artifact, right.candidate.semantic.artifact))[0];
    if (!selected) break;
    seeds.push(selected.candidate);
  }
  return seeds;
}

function deterministicClusters(candidates: VectorCandidate[]): Cluster[] {
  const k = Math.min(MIST_CLUSTER_COUNT, candidates.length);
  if (!k) return [];
  const seeds = chooseSeedCandidates(candidates, k);
  let clusters = seeds.map((seed, index) => ({ id: `cluster:${index + 1}`, vector: [...seed.vector], members: [] as VectorCandidate[] }));

  for (let iteration = 0; iteration < MIST_KMEANS_MAX_ITERATIONS; iteration += 1) {
    const assigned = clusters.map((cluster) => ({ ...cluster, members: [] as VectorCandidate[] }));
    for (const candidate of candidates) {
      const cluster = assigned
        .map((entry) => ({ entry, distance: squaredDistance(candidate.vector, entry.vector) }))
        .sort((left, right) => left.distance - right.distance || left.entry.id.localeCompare(right.entry.id))[0].entry;
      cluster.members.push(candidate);
    }
    const next = assigned.map((cluster) => ({
      ...cluster,
      members: [...cluster.members].sort((left, right) => compareArtifacts(left.semantic.artifact, right.semantic.artifact)),
      vector: cluster.members.length ? centroid(cluster.members.map((member) => member.vector)) : cluster.vector,
    }));
    const stable = next.every((cluster, index) => squaredDistance(cluster.vector, clusters[index].vector) === 0
      && cluster.members.map((member) => member.semantic.artifact.cid).join("|") === clusters[index].members.map((member) => member.semantic.artifact.cid).join("|"));
    clusters = next;
    if (stable) break;
  }
  return clusters.filter((cluster) => cluster.members.length > 0);
}

function metadataFields(artifact: CorpusArtifact): Array<[string, string]> {
  const metadata = artifact.metadata;
  return [
    ["source", metadata.source],
    ["filename", metadata.filename],
    ["documentType", metadata.documentType],
    ["title", metadata.title ?? ""],
    ["section", metadata.section ?? ""],
    ["tags", metadata.tags.join(" ")],
    ["author", metadata.author ?? ""],
    ["timestamp", metadata.timestamp ?? ""],
    ["role", metadata.role ?? ""],
    ["scope", metadata.scope ?? ""],
    ["keywords", metadata.keywords.join(" ")],
  ];
}

function toFusionInput(layers: {
  lexical: MistLayer<MistLexicalCandidate>;
  semantic: MistLayer<MistSemanticCandidate>;
  centroid: MistLayer<MistCentroid>;
  echoes: MistLayer<MistEcho>;
  patterns: MistLayer<MistPattern>;
  arcana: MistLayer<MistArcana>;
}): FusionInput[] {
  return [
    ...layers.lexical.candidates.map((candidate) => ({ layer: "L1_LEXICAL" as const, artifact: candidate.artifact, score: candidate.score, rank: candidate.rank })),
    ...layers.semantic.candidates.map((candidate) => ({ layer: "L2_SEMANTIC" as const, artifact: candidate.artifact, score: candidate.score, rank: candidate.rank })),
    ...layers.centroid.candidates.map((candidate) => ({ layer: "L3_CENTROID" as const, artifact: candidate.representative, score: candidate.representativeScore, rank: candidate.rank })),
    ...layers.echoes.candidates.map((candidate) => ({ layer: "L4_ECHOES" as const, artifact: candidate.artifact, score: candidate.layerScore, rank: candidate.rank })),
    ...layers.patterns.candidates.map((candidate) => ({ layer: "L5_PATTERNS" as const, artifact: candidate.artifact, score: candidate.bridgeScore, rank: candidate.rank })),
    ...layers.arcana.candidates.map((candidate) => ({ layer: "L6_ARCANA" as const, artifact: candidate.artifact, score: candidate.score, rank: candidate.rank })),
  ];
}

function fuse(layers: Parameters<typeof toFusionInput>[0], status: MistFusionResult["status"], reason: string | null): MistFusionResult {
  if (status === "EMPTY") return { id: "L7_RRF_FUSION", status, rrfConstant: MIST_RRF_CONSTANT, candidates: [], reason };
  const records = new Map<string, MistFusionArtifact>();
  for (const input of toFusionInput(layers)) {
    const current = records.get(input.artifact.cid) ?? {
      artifact: input.artifact,
      layerMemberships: [],
      layerRanks: {},
      layerScores: {},
      rrfScore: 0,
      rank: 0,
    };
    const existingRank = current.layerRanks[input.layer];
    if (existingRank === undefined || input.rank < existingRank) {
      if (existingRank !== undefined) current.rrfScore -= 1 / (MIST_RRF_CONSTANT + existingRank);
      current.layerRanks[input.layer] = input.rank;
      current.layerScores[input.layer] = input.score;
      current.rrfScore += 1 / (MIST_RRF_CONSTANT + input.rank);
    }
    if (!current.layerMemberships.includes(input.layer)) current.layerMemberships.push(input.layer);
    records.set(input.artifact.cid, current);
  }
  const candidates = Array.from(records.values())
    .map((candidate) => ({ ...candidate, layerMemberships: [...candidate.layerMemberships].sort() as MistFusionSourceLayer[] }))
    .sort((left, right) => right.rrfScore - left.rrfScore || compareArtifacts(left.artifact, right.artifact))
    .slice(0, MIST_FUSION_LIMIT)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  return { id: "L7_RRF_FUSION", status: candidates.length ? status : "EMPTY", rrfConstant: MIST_RRF_CONSTANT, candidates, reason: candidates.length ? reason : "No candidates were available for RRF fusion." };
}

function toVectorCandidates(semantic: MistSemanticCandidate[], embeddings: CorpusEmbedding[], dimension: number): VectorCandidate[] {
  const embeddingByCid = new Map(embeddings.map((embedding) => [embedding.chunkCid, embedding]));
  return semantic.flatMap((candidate) => {
    const embedding = embeddingByCid.get(candidate.artifact.cid);
    if (!embedding || embedding.vector.length !== dimension || !embedding.vector.every(Number.isFinite)) return [];
    return [{ semantic: candidate, vector: [...embedding.vector] }];
  });
}

/**
 * Deterministic local MIST retrieval core. It operates on browser-local corpus
 * chunks and locally generated embeddings only. It has no UI, network, LLM,
 * attestation, or Phoenix-recursion dependency.
 */
export class MistCore {
  private readonly similarity: LocalCorpusSimilarityService;

  constructor(
    private readonly store: CorpusStore,
    private readonly provider: EmbeddingProvider,
  ) {
    this.similarity = new LocalCorpusSimilarityService(store, provider);
  }

  async retrieve(rawQuery: string, options: MistRetrieveOptions = {}): Promise<MistResult> {
    const normalized = normalizeCorpusText(rawQuery);
    const tokens = mistTokens(normalized);
    if (!tokens.length) throw new Error("MIST retrieval query cannot be empty after normalization.");
    const query: MistQuery = {
      raw: rawQuery,
      normalized,
      tokens,
      hash: await sha256Hex(canonicalJson({ schemaVersion: MIST_SCHEMA_VERSION, query: normalized, documentId: options.documentId ?? null })),
      documentId: options.documentId ?? null,
    };
    const artifacts = await this.store.listChunks(options.documentId);
    if (!artifacts.length) return this.emptyCorpus(query);

    const lexical = this.lexical(query, artifacts);
    const arcana = this.arcana(query, artifacts);
    try {
      const indexing = await this.similarity.index(options.documentId);
      const semantic = await this.semantic(query, options.documentId);
      const vectors = toVectorCandidates(semantic.candidates, await this.store.listEmbeddings(), indexing.dimension);
      const centroid = this.centroids(vectors);
      const echoes = this.echoes(vectors, centroid.candidates);
      const patterns = this.patterns(vectors, centroid.candidates);
      const fusion = fuse({ lexical, semantic, centroid, echoes, patterns, arcana }, "EXECUTED", null);
      return this.result("COMPLETE", query, indexing, lexical, semantic, centroid, echoes, patterns, arcana, fusion);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const semantic = emptyLayer<MistSemanticCandidate>("L2_SEMANTIC", "UNAVAILABLE", reason);
      const centroid = emptyLayer<MistCentroid>("L3_CENTROID", "UNAVAILABLE", "L2 semantic retrieval is unavailable.");
      const echoes = emptyLayer<MistEcho>("L4_ECHOES", "UNAVAILABLE", "L3 centroid retrieval is unavailable.");
      const patterns = emptyLayer<MistPattern>("L5_PATTERNS", "UNAVAILABLE", "L3 centroid retrieval is unavailable.");
      const fusion = fuse({ lexical, semantic, centroid, echoes, patterns, arcana }, "EXECUTED", "Semantic layers were unavailable; fusion contains deterministic L1/L6 evidence only.");
      return this.result("PARTIAL", query, null, lexical, semantic, centroid, echoes, patterns, arcana, fusion);
    }
  }

  private lexical(query: MistQuery, artifacts: CorpusArtifact[]): MistLayer<MistLexicalCandidate> {
    const candidates = artifacts.map((artifact) => {
      const artifactTokens = new Set(mistTokens(artifact.content));
      const matchedTokens = query.tokens.filter((token) => artifactTokens.has(token));
      return { artifact, matchedTokens, score: matchedTokens.length / query.tokens.length };
    }).filter((candidate) => candidate.score > 0);
    const ranked = rank(candidates, MIST_LEXICAL_LIMIT);
    return { id: "L1_LEXICAL", status: ranked.length ? "EXECUTED" : "EMPTY", candidates: ranked, reason: ranked.length ? null : "No exact normalized token overlap." };
  }

  private async semantic(query: MistQuery, documentId?: string): Promise<MistLayer<MistSemanticCandidate>> {
    const candidates = await this.similarity.search({ query: query.normalized, documentId, limit: MIST_SEMANTIC_LIMIT, minScore: -1 });
    const ranked = candidates.map((candidate, index) => ({
      artifact: candidate.artifact,
      score: candidate.score,
      rank: index + 1,
      model: candidate.embedding.model,
      modelVersion: candidate.embedding.modelVersion,
    }));
    return { id: "L2_SEMANTIC", status: ranked.length ? "EXECUTED" : "EMPTY", candidates: ranked, reason: ranked.length ? null : "No compatible local embeddings were available." };
  }

  private centroids(vectors: VectorCandidate[]): MistLayer<MistCentroid> {
    const clusters = deterministicClusters(vectors);
    const candidates = clusters.map((cluster) => {
      const representative = [...cluster.members]
        .map((member) => ({ member, distance: squaredDistance(member.vector, cluster.vector) }))
        .sort((left, right) => left.distance - right.distance || compareArtifacts(left.member.semantic.artifact, right.member.semantic.artifact))[0].member;
      const id = `centroid:${cluster.id}:${representative.semantic.artifact.cid}`;
      return {
        id,
        centroid: [...cluster.vector],
        representative: representative.semantic.artifact,
        representativeScore: cosineSimilarity(representative.vector, cluster.vector),
        memberCids: cluster.members.map((member) => member.semantic.artifact.cid),
        memberCount: cluster.members.length,
      };
    }).sort((left, right) => left.id.localeCompare(right.id)).map((candidate, index) => ({ ...candidate, rank: index + 1 }));
    return { id: "L3_CENTROID", status: candidates.length ? "EXECUTED" : "EMPTY", candidates, reason: candidates.length ? null : "No semantic vectors were available for clustering." };
  }

  private echoes(vectors: VectorCandidate[], centroids: MistCentroid[]): MistLayer<MistEcho> {
    const echoes = centroids.flatMap((centroidEntry) => vectors
      .filter((candidate) => candidate.semantic.artifact.cid !== centroidEntry.representative.cid)
      .map((candidate) => {
        const similarity = cosineSimilarity(candidate.vector, centroidEntry.centroid);
        return {
          artifact: candidate.semantic.artifact,
          centroidId: centroidEntry.id,
          sourceArtifactCid: centroidEntry.representative.cid,
          similarity,
          distance: 1 - similarity,
          layerScore: similarity,
        };
      })
      .filter((candidate) => candidate.similarity > MIST_ECHO_MIN_SIMILARITY)
      .sort((left, right) => right.distance - left.distance || compareArtifacts(left.artifact, right.artifact))
      .slice(0, MIST_ECHO_LIMIT_PER_CENTROID));
    const candidates = echoes
      .sort((left, right) => right.layerScore - left.layerScore || compareArtifacts(left.artifact, right.artifact) || left.centroidId.localeCompare(right.centroidId))
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
    return { id: "L4_ECHOES", status: candidates.length ? "EXECUTED" : "EMPTY", candidates, reason: candidates.length ? null : `No boundary artifacts exceeded cosine similarity ${MIST_ECHO_MIN_SIMILARITY}.` };
  }

  private patterns(vectors: VectorCandidate[], centroids: MistCentroid[]): MistLayer<MistPattern> {
    const candidates = vectors.flatMap((candidate) => {
      const clusterSimilarities = centroids
        .map((cluster) => ({ cluster, similarity: cosineSimilarity(candidate.vector, cluster.centroid) }))
        .sort((left, right) => right.similarity - left.similarity || left.cluster.id.localeCompare(right.cluster.id));
      const [first, second] = clusterSimilarities;
      if (!first || !second || second.similarity < MIST_BRIDGE_MIN_SIMILARITY) return [];
      const crossClusterRelevance = Math.min(first.similarity, second.similarity);
      return [{
        artifact: candidate.semantic.artifact,
        clusterIds: [first.cluster.id, second.cluster.id] as [string, string],
        similarityToClusterA: first.similarity,
        similarityToClusterB: second.similarity,
        crossClusterRelevance,
        bridgeScore: first.similarity + second.similarity + crossClusterRelevance,
      }];
    });
    const ranked = rank(candidates.map((candidate) => ({ ...candidate, score: candidate.bridgeScore })), MIST_PATTERN_LIMIT)
      .map(({ score: _score, ...candidate }) => candidate);
    return { id: "L5_PATTERNS", status: ranked.length ? "EXECUTED" : "EMPTY", candidates: ranked, reason: ranked.length ? null : `No artifact connected two centroids above similarity ${MIST_BRIDGE_MIN_SIMILARITY}.` };
  }

  private arcana(query: MistQuery, artifacts: CorpusArtifact[]): MistLayer<MistArcana> {
    const candidates = artifacts.map((artifact) => {
      const matchedMetadata = metadataFields(artifact)
        .filter(([, value]) => {
          const metadataTokens = new Set(mistTokens(value));
          return query.tokens.some((token) => metadataTokens.has(token));
        })
        .map(([field]) => field);
      const metadataTokens = new Set(metadataFields(artifact).flatMap(([, value]) => mistTokens(value)));
      const score = query.tokens.filter((token) => metadataTokens.has(token)).length / query.tokens.length;
      return { artifact, matchedMetadata, score };
    }).filter((candidate) => candidate.score > 0);
    const ranked = rank(candidates, MIST_ARCANA_LIMIT);
    return { id: "L6_ARCANA", status: ranked.length ? "EXECUTED" : "EMPTY", candidates: ranked, reason: ranked.length ? null : "No exact normalized metadata overlap." };
  }

  private emptyCorpus(query: MistQuery): MistResult {
    const lexical = emptyLayer<MistLexicalCandidate>("L1_LEXICAL", "EMPTY", "The selected corpus contains no chunks.");
    const semantic = emptyLayer<MistSemanticCandidate>("L2_SEMANTIC", "EMPTY", "The selected corpus contains no chunks.");
    const centroid = emptyLayer<MistCentroid>("L3_CENTROID", "EMPTY", "The selected corpus contains no chunks.");
    const echoes = emptyLayer<MistEcho>("L4_ECHOES", "EMPTY", "The selected corpus contains no chunks.");
    const patterns = emptyLayer<MistPattern>("L5_PATTERNS", "EMPTY", "The selected corpus contains no chunks.");
    const arcana = emptyLayer<MistArcana>("L6_ARCANA", "EMPTY", "The selected corpus contains no chunks.");
    const fusion = fuse({ lexical, semantic, centroid, echoes, patterns, arcana }, "EMPTY", "The selected corpus contains no chunks.");
    return this.result("EMPTY_CORPUS", query, null, lexical, semantic, centroid, echoes, patterns, arcana, fusion);
  }

  private result(
    status: MistStatus,
    query: MistQuery,
    indexing: MistResult["indexing"],
    lexical: MistResult["lexical"],
    semantic: MistResult["semantic"],
    centroid: MistResult["centroid"],
    echoes: MistResult["echoes"],
    patterns: MistResult["patterns"],
    arcana: MistResult["arcana"],
    fusion: MistResult["fusion"],
  ): MistResult {
    return {
      schemaVersion: MIST_SCHEMA_VERSION,
      status,
      query,
      indexing,
      lexical,
      semantic,
      centroid,
      echoes,
      patterns,
      arcana,
      fusion,
      trajectoryArtifacts: fusion.candidates.map((candidate) => ({
        artifact: candidate.artifact,
        layerMemberships: candidate.layerMemberships,
        layerScores: candidate.layerScores,
        fusionRank: candidate.rank,
        rrfScore: candidate.rrfScore,
      })),
    };
  }
}
