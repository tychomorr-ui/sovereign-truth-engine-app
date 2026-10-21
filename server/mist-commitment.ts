import { createHash } from "node:crypto";
import type { MistResult } from "./mist-core";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function merkleRoot(leaves: string[]): string {
  if (!leaves.length) return sha256("MIST_EMPTY");
  let level = [...leaves];
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(sha256(`${left}${right}`));
    }
    level = next;
  }
  return level[0];
}

export function commitMistResult(result: MistResult): { merkle_root: string; leaves: string[] } {
  const leaves = result.artifacts.map((artifact) => sha256(artifact.cid));
  return { merkle_root: merkleRoot(leaves), leaves };
}
