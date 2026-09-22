import { createReceipt, type IntelligenceReceipt } from "./sovereign-bus";
import { classifyInformation, type InformationState, type TruthState, transitionTruthState } from "./truth-state";

export type DeterministicCapability = "state_inspection" | "input_validation" | "schema_validation" | "capability_discovery" | "authorization_check" | "policy_evaluation" | "evidence_classification" | "provenance_evaluation" | "contradiction_detection" | "confidence_classification" | "request_routing" | "workflow_transition" | "receipt_generation" | "failure_classification" | "recovery_recommendation" | "resource_limit_check";
export type DeterministicFailure = "MALFORMED_REQUEST" | "AUTHORITY_REQUIRED" | "AUTHORITY_DENIED" | "CAPABILITY_UNAVAILABLE" | "CONFLICTING_EVIDENCE" | "UNKNOWN_INFORMATION" | "STALE_INFORMATION" | "INVALID_STATE_TRANSITION" | "RECURSION_LIMIT" | "OPERATION_LIMIT" | "TIMEOUT" | "PROVENANCE_UNKNOWN" | "POLICY_DENIED";

export type ResourceLimits = { maxRecursionDepth: number; maxOperations: number; maxExecutionMs: number; maxReflectionCycles: number; maxContextChars: number };
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = { maxRecursionDepth: 5, maxOperations: 100, maxExecutionMs: 2_000, maxReflectionCycles: 5, maxContextChars: 32_000 };

export type DeterministicDecision = {
  decision_id: string;
  intent: string;
  inputs: unknown[];
  capability: DeterministicCapability;
  authority: { actor: string; permitted: boolean; reason: string };
  policy: { allowed: boolean; reason: string };
  evidence: { state: InformationState; sources: string[] };
  decision: "ALLOW" | "DENY" | "REQUIRE_HUMAN_CONFIRMATION" | "UNKNOWN";
  confidence: number;
  reason: string;
  constraints: ResourceLimits;
  next_action: string;
  verification_required: boolean;
  human_confirmation_required: boolean;
  timestamp: string;
  receipt_id: string;
};

export type DeterministicResult<T> = { ok: boolean; value?: T; failure?: DeterministicFailure; receipt: IntelligenceReceipt };

const CAPABILITIES: readonly DeterministicCapability[] = ["state_inspection", "input_validation", "schema_validation", "capability_discovery", "authorization_check", "policy_evaluation", "evidence_classification", "provenance_evaluation", "contradiction_detection", "confidence_classification", "request_routing", "workflow_transition", "receipt_generation", "failure_classification", "recovery_recommendation", "resource_limit_check"];

export function listDeterministicCapabilities(): readonly DeterministicCapability[] { return CAPABILITIES; }

export function createDeterministicReceipt(operation: string, verification: string, resultState: string, sources: string[] = []): IntelligenceReceipt {
  return createReceipt({ operation: `deterministic.${operation}`, intelligence_mode: "deterministic", provider: "deterministic-core", model: null, context_sources: sources, policy: "no model inference; explicit state and authority rules", verification, result_state: resultState });
}

export function validateInput(input: unknown): DeterministicResult<{ valid: boolean; reason: string }> {
  const valid = typeof input === "object" && input !== null;
  const receipt = createDeterministicReceipt("input_validation", valid ? "input is a non-null object" : "input rejected because it is not a non-null object", valid ? "PROVEN" : "MALFORMED_REQUEST");
  return valid ? { ok: true, value: { valid, reason: "valid deterministic input" }, receipt } : { ok: false, failure: "MALFORMED_REQUEST", receipt };
}

export function classifyEvidence(input: { value?: unknown; declared?: boolean; observed?: boolean; verified?: boolean; stale?: boolean; conflicted?: boolean; authorized?: boolean; sources?: string[] }): DeterministicResult<{ state: InformationState; sources: string[] }> {
  const state = classifyInformation(input);
  const failure = state === "CONFLICTED" ? "CONFLICTING_EVIDENCE" : state === "STALE" ? "STALE_INFORMATION" : state === "UNKNOWN" ? "UNKNOWN_INFORMATION" : undefined;
  const receipt = createDeterministicReceipt("evidence_classification", `information classified as ${state}`, state === "KNOWN" ? "VERIFIED" : failure ?? "PARTIALLY_PROVEN", input.sources ?? []);
  return failure ? { ok: false, failure, value: { state, sources: input.sources ?? [] }, receipt } : { ok: true, value: { state, sources: input.sources ?? [] }, receipt };
}

export function evaluateTransition(from: TruthState, to: TruthState): DeterministicResult<{ from: TruthState; to: TruthState; allowed: boolean }> {
  try {
    const transition = transitionTruthState(from, to);
    return { ok: true, value: transition, receipt: createDeterministicReceipt("workflow_transition", transition.reason, "PROVEN") };
  } catch (error) {
    return { ok: false, failure: "INVALID_STATE_TRANSITION", receipt: createDeterministicReceipt("workflow_transition", error instanceof Error ? error.message : "invalid transition", "INVALID_STATE_TRANSITION") };
  }
}

export function checkResourceLimits(input: { recursionDepth?: number; operations?: number; elapsedMs?: number; reflectionCycles?: number; contextChars?: number }, limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS): DeterministicResult<{ withinLimits: boolean; limits: ResourceLimits }> {
  const exceeded = (input.recursionDepth ?? 0) > limits.maxRecursionDepth ? "RECURSION_LIMIT" : (input.operations ?? 0) > limits.maxOperations ? "OPERATION_LIMIT" : (input.elapsedMs ?? 0) > limits.maxExecutionMs ? "TIMEOUT" : (input.reflectionCycles ?? 0) > limits.maxReflectionCycles ? "RECURSION_LIMIT" : (input.contextChars ?? 0) > limits.maxContextChars ? "OPERATION_LIMIT" : undefined;
  const receipt = createDeterministicReceipt("resource_limit_check", exceeded ? `${exceeded} exceeded` : "all resource limits within bounds", exceeded ?? "PROVEN");
  return exceeded ? { ok: false, failure: exceeded as DeterministicFailure, value: { withinLimits: false, limits }, receipt } : { ok: true, value: { withinLimits: true, limits }, receipt };
}

export function makeDecision(input: { intent: string; actor: string; capability: DeterministicCapability; authorityPermitted: boolean; authorityReason: string; policyAllowed: boolean; policyReason: string; evidence?: Parameters<typeof classifyInformation>[0]; inputs?: unknown[]; consequential?: boolean; humanConfirmed?: boolean; constraints?: ResourceLimits }): DeterministicResult<DeterministicDecision> {
  const constraints = input.constraints ?? DEFAULT_RESOURCE_LIMITS;
  const evidenceState = classifyInformation({ ...(input.evidence ?? {}), authorized: input.evidence?.authorized ?? true });
  const humanConfirmationRequired = Boolean(input.consequential);
  const decision = !input.authorityPermitted ? "DENY" : !input.policyAllowed ? "DENY" : humanConfirmationRequired && !input.humanConfirmed ? "REQUIRE_HUMAN_CONFIRMATION" : evidenceState === "UNKNOWN" ? "UNKNOWN" : "ALLOW";
  const reason = decision === "ALLOW" ? "authority, policy, and evidence conditions are satisfied" : decision === "UNKNOWN" ? "evidence is insufficient; unknown remains unknown" : decision === "REQUIRE_HUMAN_CONFIRMATION" ? "consequential operation requires human confirmation" : !input.authorityPermitted ? input.authorityReason : input.policyReason;
  const receipt = createDeterministicReceipt("decision", reason, decision);
  const value: DeterministicDecision = { decision_id: receipt.receipt_id, intent: input.intent, inputs: input.inputs ?? [], capability: input.capability, authority: { actor: input.actor, permitted: input.authorityPermitted, reason: input.authorityReason }, policy: { allowed: input.policyAllowed, reason: input.policyReason }, evidence: { state: evidenceState, sources: input.evidence?.sources ?? [] }, decision, confidence: decision === "ALLOW" ? 0.95 : decision === "UNKNOWN" ? 0 : 1, reason, constraints, next_action: decision === "ALLOW" ? "execute within constraints" : decision === "REQUIRE_HUMAN_CONFIRMATION" ? "request explicit confirmation" : "supply authority, policy approval, or evidence", verification_required: decision !== "ALLOW", human_confirmation_required: humanConfirmationRequired, timestamp: receipt.timestamp, receipt_id: receipt.receipt_id };
  return decision === "ALLOW" ? { ok: true, value, receipt } : { ok: false, failure: decision === "REQUIRE_HUMAN_CONFIRMATION" ? "AUTHORITY_REQUIRED" : decision === "UNKNOWN" ? "UNKNOWN_INFORMATION" : input.authorityPermitted ? "POLICY_DENIED" : "AUTHORITY_DENIED", value, receipt };
}

export function classifyFailure(error: unknown): DeterministicFailure {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("timeout")) return "TIMEOUT";
  if (message.includes("recursion")) return "RECURSION_LIMIT";
  if (message.includes("authority")) return "AUTHORITY_REQUIRED";
  if (message.includes("policy")) return "POLICY_DENIED";
  if (message.includes("provenance")) return "PROVENANCE_UNKNOWN";
  return "CAPABILITY_UNAVAILABLE";
}

export function recommendRecovery(failure: DeterministicFailure): { action: string; retryable: boolean; requiresHuman: boolean } {
  if (failure === "TIMEOUT" || failure === "OPERATION_LIMIT" || failure === "RECURSION_LIMIT") return { action: "reduce scope or increase an explicitly authorized resource budget", retryable: true, requiresHuman: false };
  if (failure === "AUTHORITY_REQUIRED" || failure === "AUTHORITY_DENIED") return { action: "request or restore explicit authority", retryable: false, requiresHuman: true };
  if (failure === "POLICY_DENIED") return { action: "revise the request or obtain policy approval", retryable: false, requiresHuman: true };
  if (failure === "UNKNOWN_INFORMATION" || failure === "STALE_INFORMATION" || failure === "CONFLICTING_EVIDENCE") return { action: "collect, refresh, or adjudicate evidence", retryable: true, requiresHuman: false };
  return { action: "inspect capability availability and preserve the failure receipt", retryable: true, requiresHuman: false };
}
