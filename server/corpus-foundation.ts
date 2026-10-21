import { createHash } from "node:crypto";

export function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const size = Math.max(1, Math.floor(chunkSize));
  const safeOverlap = Math.max(0, Math.min(size - 1, Math.floor(overlap)));
  const words = normalized.split(/\s+/);
  const chunks: string[] = [];
  const step = Math.max(1, size - safeOverlap);
  for (let start = 0; start < words.length; start += step) {
    const chunk = words.slice(start, start + size).join(" ").trim();
    if (chunk) chunks.push(chunk);
    if (start + size >= words.length) break;
  }
  return chunks;
}

export function computeChunkCid(chunk: string): string {
  return createHash("sha256").update(chunk, "utf8").digest("hex");
}
