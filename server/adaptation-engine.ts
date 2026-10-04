import { randomUUID } from "node:crypto";
import { createReceipt, type IntelligenceReceipt } from "./sovereign-bus";

export const ADAPTIVE_VARIABLES = ["routing_preference", "model_selection", "tool_selection", "context_selection", "retrieval_weighting", "response_strategy", "workflow_ordering", "performance_parameters", "user_approved_preference"] as const;
export type AdaptiveVariable = (typeof ADAPTIVE_VARIABLES)[number];
export type AdaptationMode = "SHADOW" | "ACTIVE" | "ROLLED_BACK" | "REJECTED";
export type AdaptationApproval = "PENDING" | "AUTHORIZED" | "DENIED";
export type LearningSignalType = "VERIFIED_OUTCOME" | "EXPLICIT_USER_FEEDBACK" | "SUCCESSFUL_TASK" | "FAILED_TASK" | "PERFORMANCE_METRIC" | "HUMAN_CORRECTION" | "VALIDATED_EVIDENCE";
export type LearningSignal = { type: LearningSignalType; value: number; verified: boolean; receiptId?: string; contextKey: string; observedAt?: string };
export type AdaptationProposal = { adaptation_id: string; variable: AdaptiveVariable; current_state: unknown; proposed_state: unknown; reason: string; evidence: LearningSignal[]; expected_effect: string; risk: "LOW" | "MEDIUM" | "HIGH"; authority: "system" | "operator"; approval: AdaptationApproval; mode: AdaptationMode; rollback_state: unknown; result: string | null; created_at: string; activated_at: string | null; rolled_back_at: string | null; receipt_id: string };
export type AdaptationScore = { successRate: number; failureRate: number; confidence: number; sampleCount: number; recency: number; contextSimilarity: number; eligible: boolean; reason: string };
export type AdaptationLimits = { minSamples: number; minConfidence: number; maxRisk: "LOW" | "MEDIUM" };

const PROTECTED_VARIABLES = new Set(["core_security_policy", "authority", "credentials", "identity", "audit_rules", "receipt_integrity", "external_data_permissions", "system_trust_roots"]);
const DEFAULT_LIMITS: AdaptationLimits = { minSamples: 3, minConfidence: 0.7, maxRisk: "MEDIUM" };

function makeReceipt(operation: string, state: string, sources: string[]): IntelligenceReceipt { return createReceipt({ operation, intelligence_mode: "deterministic", provider: "adaptation-engine", model: null, context_sources: sources, policy: "proposal-first; protected variables immutable without explicit authorization", verification: state, result_state: state }); }
function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }

export function scoreLearningSignals(signals: LearningSignal[], contextKey: string, now = Date.now()): AdaptationScore {
  const relevant = signals.filter((signal) => signal.contextKey === contextKey);
  const successes = relevant.filter((signal) => signal.type !== "FAILED_TASK" && signal.value >= 0.5).length;
  const failures = relevant.filter((signal) => signal.type === "FAILED_TASK" || signal.value < 0.5).length;
  const sampleCount = relevant.length;
  const successRate = sampleCount ? successes / sampleCount : 0;
  const failureRate = sampleCount ? failures / sampleCount : 0;
  const confidence = clamp((relevant.filter((signal) => signal.verified).length / Math.max(1, sampleCount)) * Math.min(1, sampleCount / DEFAULT_LIMITS.minSamples));
  const latest = relevant.map((signal) => new Date(signal.observedAt ?? 0).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0] ?? now;
  const ageDays = Math.max(0, (now - latest) / 86_400_000);
  const recency = clamp(1 / (1 + ageDays / 30));
  const contextSimilarity = relevant.length ? 1 : 0;
  return { successRate, failureRate, confidence, sampleCount, recency, contextSimilarity, eligible: sampleCount >= DEFAULT_LIMITS.minSamples && confidence >= DEFAULT_LIMITS.minConfidence && successRate > failureRate, reason: sampleCount < DEFAULT_LIMITS.minSamples ? "insufficient samples" : confidence < DEFAULT_LIMITS.minConfidence ? "insufficient verified confidence" : successRate <= failureRate ? "outcomes do not support activation" : "evidence threshold met" };
}

export function proposeAdaptation(input: { variable: AdaptiveVariable; currentState: unknown; proposedState: unknown; reason: string; expectedEffect: string; risk: AdaptationProposal["risk"]; authority?: AdaptationProposal["authority"]; evidence: LearningSignal[]; contextKey: string; limits?: Partial<AdaptationLimits> }): { proposal: AdaptationProposal; score: AdaptationScore; receipt: IntelligenceReceipt } {
  if (PROTECTED_VARIABLES.has(input.variable)) throw new Error(`Protected variable cannot be adapted automatically: ${input.variable}`);
  const score = scoreLearningSignals(input.evidence, input.contextKey);
  const limits = { ...DEFAULT_LIMITS, ...(input.limits ?? {}) };
  const allowedRisk = input.risk === "LOW" || (input.risk === "MEDIUM" && limits.maxRisk === "MEDIUM");
  const proposal: AdaptationProposal = { adaptation_id: randomUUID(), variable: input.variable, current_state: input.currentState, proposed_state: input.proposedState, reason: input.reason, evidence: input.evidence, expected_effect: input.expectedEffect, risk: input.risk, authority: input.authority ?? "system", approval: "PENDING", mode: "SHADOW", rollback_state: input.currentState, result: null, created_at: new Date().toISOString(), activated_at: null, rolled_back_at: null, receipt_id: "" };
  const receipt = makeReceipt("adaptation.propose", score.eligible && allowedRisk ? "PROPOSAL_ELIGIBLE" : "PROPOSAL_INSUFFICIENT_EVIDENCE", input.evidence.flatMap((signal) => signal.receiptId ? [signal.receiptId] : []));
  proposal.receipt_id = receipt.receipt_id;
  return { proposal, score: { ...score, eligible: score.eligible && allowedRisk, reason: !allowedRisk ? "risk exceeds configured activation limit" : score.reason }, receipt };
}

export function evaluateShadow(proposal: AdaptationProposal, observedEffect: { success: boolean; metric?: number; receiptId?: string }): { proposal: AdaptationProposal; receipt: IntelligenceReceipt } {
  if (proposal.mode !== "SHADOW") throw new Error("Only shadow proposals can be evaluated.");
  const updated = { ...proposal, result: observedEffect.success ? "shadow outcome positive" : "shadow outcome negative", evidence: [...proposal.evidence, { type: observedEffect.success ? "SUCCESSFUL_TASK" : "FAILED_TASK", value: observedEffect.metric ?? (observedEffect.success ? 1 : 0), verified: false, receiptId: observedEffect.receiptId, contextKey: proposal.variable, observedAt: new Date().toISOString() } satisfies LearningSignal] };
  return { proposal: updated, receipt: makeReceipt("adaptation.shadow", observedEffect.success ? "SHADOW_POSITIVE" : "SHADOW_NEGATIVE", [proposal.receipt_id, ...(observedEffect.receiptId ? [observedEffect.receiptId] : [])]) };
}

export function activateAdaptation(proposal: AdaptationProposal, authorization: { approved: boolean; actor: "operator" | "system"; reason: string }): { proposal: AdaptationProposal; receipt: IntelligenceReceipt } {
  const verifiedSuccesses = proposal.evidence.filter((signal) => signal.verified && signal.type !== "FAILED_TASK" && signal.value >= 0.5).length;
  const failures = proposal.evidence.filter((signal) => signal.type === "FAILED_TASK" || signal.value < 0.5).length;
  if (proposal.mode !== "SHADOW" || proposal.approval !== "PENDING" || verifiedSuccesses < DEFAULT_LIMITS.minSamples || verifiedSuccesses <= failures) return { proposal: { ...proposal, approval: "DENIED", mode: "REJECTED", result: "activation denied: proposal is not evidence-eligible" }, receipt: makeReceipt("adaptation.activate.denied", "INSUFFICIENT_EVIDENCE", [proposal.receipt_id]) };
  if (!authorization.approved || authorization.actor !== "operator") return { proposal: { ...proposal, approval: "DENIED", mode: "REJECTED", result: "activation denied: explicit operator authorization required" }, receipt: makeReceipt("adaptation.activate.denied", "AUTHORIZATION_REQUIRED", [proposal.receipt_id]) };
  if (proposal.risk === "HIGH") return { proposal: { ...proposal, approval: "DENIED", mode: "REJECTED", result: "activation denied: high-risk adaptation requires separate policy authorization" }, receipt: makeReceipt("adaptation.activate.denied", "POLICY_PROTECTED", [proposal.receipt_id]) };
  const activated = { ...proposal, approval: "AUTHORIZED" as const, mode: "ACTIVE" as const, activated_at: new Date().toISOString(), result: authorization.reason };
  return { proposal: activated, receipt: makeReceipt("adaptation.activate", "ADAPTATION_ACTIVE", [proposal.receipt_id]) };
}

export function rollbackAdaptation(proposal: AdaptationProposal, reason: string): { proposal: AdaptationProposal; receipt: IntelligenceReceipt } {
  if (proposal.mode !== "ACTIVE") throw new Error("Only active adaptations can be rolled back.");
  const rolledBack = { ...proposal, mode: "ROLLED_BACK" as const, proposed_state: proposal.rollback_state, rolled_back_at: new Date().toISOString(), result: `rolled back: ${reason}` };
  return { proposal: rolledBack, receipt: makeReceipt("adaptation.rollback", "ROLLBACK_COMPLETE", [proposal.receipt_id]) };
}

export function isProtectedVariable(variable: string): boolean { return PROTECTED_VARIABLES.has(variable); }
