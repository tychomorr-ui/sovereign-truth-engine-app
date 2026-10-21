export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    const left = Number(a[index]);
    const right = Number(b[index]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
    dot += left * right;
    aMagnitude += left * left;
    bMagnitude += right * right;
  }
  const denominator = Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude);
  return denominator > 0 ? dot / denominator : 0;
}

export function topKSimilar(
  queryEmbedding: number[],
  candidates: Array<{ id: string; embedding: number[] }>,
  k: number,
): Array<{ id: string; score: number }> {
  return candidates
    .map((candidate) => ({ id: candidate.id, score: cosineSimilarity(queryEmbedding, candidate.embedding) }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, Math.max(0, Math.floor(k)));
}
