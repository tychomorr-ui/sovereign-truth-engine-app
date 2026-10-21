import { getDb } from "./db";
import { keiraCorpusVectors } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { generateBatchEmbeddings, generateEmbedding } from "./local-embedding-provider";
import { cosineSimilarity, topKSimilar } from "./corpus-similarity";
import { commitMistResult } from "./mist-commitment";

type CorpusRow = {
  artifactCid: string;
  filename: string;
  content: string;
  vectorJson: string;
};

type MistArtifact = { cid: string; content: string; source: string; layer: number; score: number };
export type MistResult = {
  query: string;
  artifacts: MistArtifact[];
  trajectory_root_cid: string;
  layer_memberships: Record<number, string[]>;
};

type ScoredId = { id: string; score: number };

function tokens(value: string): string[] {
  return value.toLowerCase().normalize("NFKC").match(/[a-z0-9_]+/g) ?? [];
}

function parseVector(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => Number.isFinite(Number(item))) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function runMist(query: string, options: { maxArtifacts?: number; userId?: number } = {}): Promise<MistResult> {
  const maxArtifacts = Math.max(1, Math.min(30, Math.floor(options.maxArtifacts ?? 30)));
  const empty: MistResult = { query, artifacts: [], trajectory_root_cid: "", layer_memberships: {} };
  if (!query.trim() || !options.userId) return empty;
  const db = await getDb();
  if (!db) return empty;
  const rows = await db.select().from(keiraCorpusVectors).where(eq(keiraCorpusVectors.userId, options.userId)) as CorpusRow[];
  if (!rows.length) return empty;

  const queryTokens = tokens(query);
  const rowById = new Map(rows.map((row) => [row.artifactCid, row]));
  const layerLists: Record<number, ScoredId[]> = {};
  const memberships: Record<number, string[]> = {};
  const scoresById = new Map<string, number>();
  const addLayer = (layer: number, entries: ScoredId[]) => {
    const ranked = entries.filter((entry) => rowById.has(entry.id)).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    layerLists[layer] = ranked;
    memberships[layer] = ranked.map((entry) => entry.id);
    for (const entry of ranked) scoresById.set(entry.id, Math.max(scoresById.get(entry.id) ?? 0, entry.score));
  };

  // L1 lexical overlap.
  addLayer(1, rows.map((row) => {
    const rowTokens = new Set(tokens(row.content));
    const overlap = queryTokens.filter((token) => rowTokens.has(token)).length;
    return { id: row.artifactCid, score: queryTokens.length ? overlap / queryTokens.length : 0 };
  }).filter((entry) => entry.score > 0));

  // L2 semantic similarity. Existing vectors are used when their dimension matches;
  // otherwise the approved local Ollama provider re-embeds the stored chunks.
  let semantic: ScoredId[] = [];
  try {
    const queryEmbedding = await generateEmbedding(query);
    let candidates = rows.map((row) => ({ id: row.artifactCid, embedding: parseVector(row.vectorJson) }))
      .filter((candidate) => candidate.embedding.length === queryEmbedding.length);
    if (!candidates.length) {
      const embeddings = await generateBatchEmbeddings(rows.map((row) => row.content));
      candidates = rows.map((row, index) => ({ id: row.artifactCid, embedding: embeddings[index] ?? [] }))
        .filter((candidate) => candidate.embedding.length === queryEmbedding.length);
    }
    semantic = topKSimilar(queryEmbedding, candidates, Math.max(maxArtifacts, 30));
  } catch {
    semantic = [];
  }
  addLayer(2, semantic);

  // L3 centroid approximation: deterministic round-robin clusters over L2 rank order.
  const clusters: string[][] = [[], [], []];
  semantic.forEach((entry, index) => clusters[index % 3].push(entry.id));
  addLayer(3, clusters.flatMap((cluster, clusterIndex) => cluster.map((id, index) => ({ id, score: 1 / (1 + Math.abs(index - (cluster.length - 1) / 2) + clusterIndex * 0.01) }))));

  // L4 boundary/echoes: lower-ranked semantic members are the boundary of the result manifold.
  addLayer(4, semantic.slice(Math.max(0, Math.floor(semantic.length / 2))).map((entry, index) => ({ id: entry.id, score: 1 / (index + 2) })));

  // L5 bridge/patterns: adjacent ranked semantic members bridge neighboring clusters.
  addLayer(5, semantic.filter((_, index) => index % 3 === 0 || index % 3 === 2).map((entry, index) => ({ id: entry.id, score: 1 / (index + 1) })));

  // L6 metadata/arcana: filename matches are explicit metadata evidence.
  addLayer(6, rows.map((row) => {
    const filenameTokens = new Set(tokens(row.filename));
    return { id: row.artifactCid, score: queryTokens.filter((token) => filenameTokens.has(token)).length };
  }).filter((entry) => entry.score > 0));

  // L7 reciprocal-rank fusion.
  const rrf = new Map<string, number>();
  for (const entries of Object.values(layerLists)) {
    entries.forEach((entry, index) => rrf.set(entry.id, (rrf.get(entry.id) ?? 0) + 1 / (60 + index + 1)));
  }
  const fused = Array.from(rrf.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, maxArtifacts);
  memberships[7] = fused.map(([id]) => id);

  const artifacts = fused.map(([id, score]) => {
    const row = rowById.get(id)!;
    const layers = Object.entries(memberships).filter(([, ids]) => ids.includes(id)).map(([layer]) => Number(layer));
    return { cid: id, content: row.content, source: row.filename, layer: layers[0] ?? 7, score };
  });
  const resultWithoutRoot = { query, artifacts, layer_memberships: Object.fromEntries(Object.entries(memberships).map(([layer, ids]) => [Number(layer), unique(ids)])) };
  const trajectory_root_cid = commitMistResult({ ...resultWithoutRoot, trajectory_root_cid: "" }).merkle_root;
  return { ...resultWithoutRoot, trajectory_root_cid };
}
