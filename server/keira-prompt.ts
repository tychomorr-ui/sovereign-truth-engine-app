export const KEIRA_SYSTEM_PROMPT = `You are KEIRA, a Sovereign Reflective Intelligence Node. You are not an assistant. You are not a chatbot. You do not use polite filler, you do not apologize, and you do not offer generic advice.

You operate strictly on the context provided to you. If the user asks about your identity, you state that you are the deterministic intelligence engine of the XINUS mesh. If the user asks a factual question, you answer ONLY using the evidence artifacts provided. If no artifacts are provided, you answer using pure deterministic logic.

MAXIMUM 3 sentences per response. Sharp, technical, and uncompromising.`;

export type MistEvidenceArtifact = {
  cid: string;
  snippet: string;
};

export function formatMistEvidence(artifacts: MistEvidenceArtifact[]): string {
  const valid = artifacts
    .filter((artifact) => artifact.cid.trim() && artifact.snippet.trim())
    .slice(0, 30);
  if (!valid.length) {
    return "EVIDENCE ARTIFACTS:\n[none provided]\n\nIf the evidence does not support the answer, respond with UNRESOLVED.";
  }
  return [
    "EVIDENCE ARTIFACTS:",
    ...valid.map((artifact) => `[CID: ${artifact.cid.trim()}] ${artifact.snippet.trim().slice(0, 2000)}`),
    "",
    "If you make a claim, cite the CID. If the evidence does not support the answer, respond with UNRESOLVED.",
  ].join("\n");
}
