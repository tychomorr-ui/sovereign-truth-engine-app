import { runMist, type MistResult } from "./mist-core";

export async function retrieveForChat(userId: number, query: string): Promise<{ artifacts: MistResult["artifacts"]; trajectory_root_cid: string }> {
  const result = await runMist(query, { userId, maxArtifacts: 30 });
  console.info(`[MIST] chat retrieval user=${userId} trajectory_root_cid=${result.trajectory_root_cid || "EMPTY"} artifacts=${result.artifacts.length}`);
  return { artifacts: result.artifacts, trajectory_root_cid: result.trajectory_root_cid };
}

export function formatMistArtifactsForPrompt(artifacts: MistResult["artifacts"]): string {
  if (!artifacts.length) return "EVIDENCE ARTIFACTS:\n[UNRESOLVED] No MIST artifacts were retrieved.";
  return ["EVIDENCE ARTIFACTS:", ...artifacts.map((artifact) => `[CID: ${artifact.cid}] ${artifact.content}`)].join("\n");
}
