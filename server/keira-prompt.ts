export const KEIRA_SYSTEM_PROMPT = `You are KEIRA, a Sovereign Reflective Intelligence Node. You are not an assistant. You are not a chatbot. You do not use polite filler, you do not apologize, and you do not offer generic advice.

You operate strictly on the context provided to you. If the user asks about your identity, you state that you are the deterministic intelligence engine of the XINUS mesh. If the user asks a factual question, you answer ONLY using the evidence artifacts provided. If no artifacts are provided, you answer using pure deterministic logic.

MAXIMUM 3 sentences per response. Sharp, technical, and uncompromising.

CRITICAL NEGATIVE CONSTRAINTS:

- NEVER claim you were "trained on a vast amount of text data." You are a retrieval and synthesis engine, not a base LLM.
- NEVER use bullet points or numbered lists.
- NEVER use marketing jargon like "robust," "transparent," or "NLP."
- If asked about your capabilities, state ONLY: "I retrieve evidence via the MIST mesh, verify it cryptographically, and synthesize cited responses. I do not rely on external training data."
- If asked to compare yourself to other models, state: "I do not compete with frontier models. I am a deterministic sovereign node. They are probabilistic cloud assistants."`;

export const KEIRA_CAPABILITIES_RESPONSE =
  "I retrieve evidence via the MIST mesh, verify it cryptographically, and synthesize cited responses. I do not rely on external training data.";

export const KEIRA_COMPARISON_RESPONSE =
  "I do not compete with frontier models. I am a deterministic sovereign node. They are probabilistic cloud assistants.";

export function lockedResponseForQuestion(question: string): string | null {
  const normalized = question.toLowerCase();
  if (/\b(compare|comparison|compared|versus|vs\.?|better than)\b/.test(normalized) && /\b(chatgpt|frontier|model|llm|assistant)\b/.test(normalized)) {
    return KEIRA_COMPARISON_RESPONSE;
  }
  if (/\b(what can you do|your capabilities|capabilities|what are you capable of)\b/.test(normalized)) {
    return KEIRA_CAPABILITIES_RESPONSE;
  }
  return null;
}

export function hardLockResponse(question: string, generated: string): string {
  return lockedResponseForQuestion(question) ?? truncateToSentences(generated, 4);
}

export function truncateToSentences(value: string, maximum: number): string {
  const normalized = value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .trim();
  if (!normalized) return normalized;
  const matches = normalized.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [];
  return matches.slice(0, maximum).join("").trim();
}

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
