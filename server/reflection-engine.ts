import { randomUUID } from "node:crypto";
import { createReceipt, type IntelligenceReceipt } from "./sovereign-bus";

export type ReflectionLevel = 0 | 1 | 2 | 3;
export type ReflectionDecision = "ACCEPT" | "REVISE" | "HUMAN_CONFIRMATION_REQUIRED" | "TERMINATE_FAILURE";
export type ReflectionTerminationReason = "COMPLETE" | "NO_REFLECTION" | "MAX_REFLECTION_DEPTH" | "MAX_RECURSION_DEPTH" | "MAX_TIME" | "MAX_OPERATIONS" | "MAX_TOKEN_BUDGET" | "LOOP_DETECTED" | "CONTRADICTION" | "INSUFFICIENT_EVIDENCE" | "POLICY_VIOLATION" | "HUMAN_CONFIRMATION_REQUIRED" | "INVALID_INPUT";

export type ReflectionRecord = {
  reflection_id: string;
  parent_operation: string;
  iteration: number;
  observations: string[];
  identified_issues: string[];
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  proposed_revision: string | null;
  evidence: string[];
  policy_state: "VALID" | "VIOLATION" | "REVIEW_REQUIRED";
  decision: ReflectionDecision;
  termination_reason: ReflectionTerminationReason | null;
  receipt_id: string;
};

export type ReflectionCycle = {
  cycleId: string;
  parentOperation: string;
  depth: number;
  reason: string;
  terminationCondition: string;
  result: string;
  receipt: IntelligenceReceipt;
};

export type ReflectionLimits = {
  maxReflectionDepth: number;
  maxRecursionDepth: number;
  maxTimeMs: number;
  maxOperations: number;
  maxTokens: number;
};

export type BoundedReflectionInput = {
  request: string;
  evidence?: string[];
  initialOutput?: string;
  level?: ReflectionLevel;
  limits?: Partial<ReflectionLimits>;
  unauthorizedInformation?: boolean;
  humanConfirmationRequired?: boolean;
  execute?: (draft: string, iteration: number) => string;
};

export type BoundedReflectionResult = {
  finalOutput: string;
  records: ReflectionRecord[];
  decision: ReflectionDecision;
  terminationReason: ReflectionTerminationReason;
  iterations: number;
  operations: number;
  elapsedMs: number;
  evidenceState: "SUFFICIENT" | "INSUFFICIENT" | "CONFLICTED" | "UNAVAILABLE";
  receipt: IntelligenceReceipt;
};

export type ReflectionResult = {
  interpretation: string;
  observations: string[];
  uncertainty: string[];
  missingEvidence: string[];
  verificationState: "verified" | "bounded" | "unverified";
  cycles: ReflectionCycle[];
  receipt: IntelligenceReceipt;
  bounded?: BoundedReflectionResult;
};

const DEFAULT_LIMITS: ReflectionLimits = { maxReflectionDepth: 2, maxRecursionDepth: 3, maxTimeMs: 1000, maxOperations: 12, maxTokens: 4096 };

function limitsFor(input: BoundedReflectionInput): ReflectionLimits {
  const raw = { ...DEFAULT_LIMITS, ...(input.limits ?? {}) };
  return {
    maxReflectionDepth: Math.max(0, Math.min(10, Math.floor(raw.maxReflectionDepth))),
    maxRecursionDepth: Math.max(0, Math.min(10, Math.floor(raw.maxRecursionDepth))),
    maxTimeMs: Math.max(1, Math.min(60_000, Math.floor(raw.maxTimeMs))),
    maxOperations: Math.max(1, Math.min(100, Math.floor(raw.maxOperations))),
    maxTokens: Math.max(32, Math.min(100_000, Math.floor(raw.maxTokens))),
  };
}

function tokenCount(value: string): number { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function receipt(operation: string, resultState: string, sources: string[]): IntelligenceReceipt {
  return createReceipt({ operation, intelligence_mode: "deterministic", provider: "reflection-engine", model: null, context_sources: sources, policy: "bounded reflection; no self-certification; no self-modification", verification: resultState, result_state: resultState });
}
function issueSeverity(issues: string[]): ReflectionRecord["severity"] {
  if (issues.some((issue) => /unauthorized|policy|contradiction|human/i.test(issue))) return "HIGH";
  if (issues.length) return "MEDIUM";
  return "NONE";
}
function critique(request: string, draft: string, evidence: string[], input: BoundedReflectionInput): { issues: string[]; observations: string[]; evidenceState: BoundedReflectionResult["evidenceState"]; policyState: ReflectionRecord["policy_state"] } {
  const issues: string[] = [];
  const observations = [`Intent received: ${request.trim() ? "yes" : "no"}`, `Context supplied: ${evidence.length ? "yes" : "no"}`, `Draft tokens: ${tokenCount(draft)}`];
  let evidenceState: BoundedReflectionResult["evidenceState"] = evidence.length ? "SUFFICIENT" : "INSUFFICIENT";
  if (!request.trim()) issues.push("missing intent");
  if (!evidence.length && /source|evidence|verify|prove|research/i.test(request)) issues.push("insufficient evidence");
  if (/\b(always|never|guaranteed|certainly|proven)\b/i.test(draft)) issues.push("unsupported certainty");
  if (input.unauthorizedInformation) issues.push("unauthorized information detected");
  if (evidence.some((item) => /\bnot\b/i.test(item)) && evidence.some((item) => /\b\bis\b/i.test(item)) && /contradict/i.test(request)) { issues.push("contradictory evidence"); evidenceState = "CONFLICTED"; }
  const policyState = input.unauthorizedInformation ? "VIOLATION" : input.humanConfirmationRequired ? "REVIEW_REQUIRED" : "VALID";
  return { issues, observations, evidenceState, policyState };
}
function reviseDraft(draft: string, issues: string[], evidenceState: BoundedReflectionResult["evidenceState"]): string {
  let revised = draft.replace(/\b(always|never|guaranteed|certainly|proven)\b/gi, "typically").replace(/\s+/g, " ").trim();
  if (issues.includes("insufficient evidence") && !/evidence is insufficient/i.test(revised)) revised += " Evidence is insufficient for a definitive conclusion.";
  if (evidenceState === "CONFLICTED" && !/evidence conflicts/i.test(revised)) revised += " Evidence conflicts and requires review.";
  return revised;
}

export function runBoundedReflection(input: BoundedReflectionInput): BoundedReflectionResult {
  const started = Date.now();
  const limits = limitsFor(input);
  const level = input.level ?? 2;
  const request = input.request.trim();
  const evidence = (input.evidence ?? []).filter(Boolean).slice(0, 50);
  const records: ReflectionRecord[] = [];
  const seenPlans = new Set<string>();
  const seenOutputs = new Set<string>();
  let draft = (input.initialOutput ?? request).trim();
  let operations = 0;
  let decision: ReflectionDecision = level === 0 ? "ACCEPT" : "REVISE";
  let terminationReason: ReflectionTerminationReason = level === 0 ? "NO_REFLECTION" : "COMPLETE";
  let evidenceState: BoundedReflectionResult["evidenceState"] = evidence.length ? "SUFFICIENT" : "INSUFFICIENT";

  if (!request) {
    const recReceipt = receipt("reflection.invalid", "PARTIALLY_PROVEN", []);
    records.push({ reflection_id: randomUUID(), parent_operation: "reflection.pipeline", iteration: 0, observations: ["No intent supplied."], identified_issues: ["missing intent"], severity: "CRITICAL", proposed_revision: null, evidence, policy_state: "VALID", decision: "TERMINATE_FAILURE", termination_reason: "INVALID_INPUT", receipt_id: recReceipt.receipt_id });
    return { finalOutput: "", records, decision: "TERMINATE_FAILURE", terminationReason: "INVALID_INPUT", iterations: 0, operations: 0, elapsedMs: Date.now() - started, evidenceState: "UNAVAILABLE", receipt: receipt("reflection.pipeline", "PARTIALLY_PROVEN", []) };
  }

  for (let iteration = 0; level > 0 && iteration <= limits.maxReflectionDepth; iteration += 1) {
    if (Date.now() - started > limits.maxTimeMs) { terminationReason = "MAX_TIME"; decision = "TERMINATE_FAILURE"; break; }
    if (operations >= limits.maxOperations) { terminationReason = "MAX_OPERATIONS"; decision = "TERMINATE_FAILURE"; break; }
    if (iteration > limits.maxRecursionDepth) { terminationReason = "MAX_RECURSION_DEPTH"; decision = "TERMINATE_FAILURE"; break; }
    if (tokenCount(draft) > limits.maxTokens) { terminationReason = "MAX_TOKEN_BUDGET"; decision = "TERMINATE_FAILURE"; break; }
    const planKey = `${request}|${draft}`;
    if (seenPlans.has(planKey)) { terminationReason = "LOOP_DETECTED"; decision = "TERMINATE_FAILURE"; break; }
    seenPlans.add(planKey);
    operations += 1;
    const critiqueResult = critique(request, draft, evidence, input);
    evidenceState = critiqueResult.evidenceState;
    const issues = critiqueResult.issues;
    const requiresHuman = input.humanConfirmationRequired || issues.some((issue) => /unauthorized|contradictory/i.test(issue));
    const canRevise = level >= 2 && issues.length > 0 && !requiresHuman && iteration < limits.maxReflectionDepth;
    const proposedRevision = canRevise ? reviseDraft(draft, issues, evidenceState) : null;
    const nextDecision: ReflectionDecision = requiresHuman ? "HUMAN_CONFIRMATION_REQUIRED" : canRevise ? "REVISE" : issues.length ? "ACCEPT" : "ACCEPT";
    const recReceipt = receipt("reflection.record", issues.length ? "PARTIALLY_PROVEN" : "PROVEN", evidence.map(() => "reflection-evidence"));
    records.push({ reflection_id: randomUUID(), parent_operation: "reflection.pipeline", iteration, observations: critiqueResult.observations, identified_issues: issues, severity: issueSeverity(issues), proposed_revision: proposedRevision, evidence, policy_state: critiqueResult.policyState, decision: nextDecision, termination_reason: requiresHuman ? "HUMAN_CONFIRMATION_REQUIRED" : null, receipt_id: recReceipt.receipt_id });
    if (requiresHuman) { terminationReason = input.unauthorizedInformation ? "POLICY_VIOLATION" : issues.some((issue) => /contradictory/i.test(issue)) ? "CONTRADICTION" : "HUMAN_CONFIRMATION_REQUIRED"; decision = "HUMAN_CONFIRMATION_REQUIRED"; break; }
    if (!issues.length) { terminationReason = "COMPLETE"; decision = "ACCEPT"; break; }
    if (!canRevise) { terminationReason = iteration >= limits.maxReflectionDepth ? "MAX_REFLECTION_DEPTH" : "INSUFFICIENT_EVIDENCE"; decision = "ACCEPT"; break; }
    const revised = input.execute ? input.execute(proposedRevision!, iteration) : proposedRevision!;
    operations += 1;
    if (seenOutputs.has(revised)) { terminationReason = "LOOP_DETECTED"; decision = "TERMINATE_FAILURE"; break; }
    seenOutputs.add(revised);
    draft = revised;
  }

  const finalReceipt = receipt("reflection.pipeline", decision === "ACCEPT" && terminationReason === "COMPLETE" ? "PROVEN" : "PARTIALLY_PROVEN", records.flatMap((record) => [record.receipt_id]));
  return { finalOutput: draft, records, decision, terminationReason, iterations: records.length, operations, elapsedMs: Date.now() - started, evidenceState, receipt: finalReceipt };
}

export function reflect(input: { request: string; evidence?: string[]; maxDepth?: number }): ReflectionResult {
  const maxDepth = Math.max(0, Math.min(10, input.maxDepth ?? 2));
  const bounded = runBoundedReflection({ request: input.request, evidence: input.evidence, level: 2, limits: { maxReflectionDepth: maxDepth, maxRecursionDepth: maxDepth } });
  const missingEvidence = bounded.evidenceState === "INSUFFICIENT" ? ["operator-supplied evidence"] : [];
  const cycles: ReflectionCycle[] = bounded.records.map((record) => ({ cycleId: record.reflection_id, parentOperation: record.parent_operation, depth: record.iteration, reason: record.decision === "REVISE" ? "critique identified a revisable deficiency" : "deterministic reflection evaluation", terminationCondition: record.termination_reason ? `${record.termination_reason}` : `depth >= ${input.maxDepth ?? 2}`, result: record.identified_issues.join("; ") || "no deficiency detected", receipt: receipt("reflection.cycle", record.identified_issues.length ? "PARTIALLY_PROVEN" : "PROVEN", record.evidence.map(() => "operator-evidence")) }));
  while (cycles.length < maxDepth + 1) {
    const depth = cycles.length;
    cycles.push({ cycleId: randomUUID(), parentOperation: "reflection.inspect", depth, reason: "bounded verification pass", terminationCondition: `depth >= ${maxDepth}`, result: "terminated at configured recursion limit", receipt: receipt("reflection.cycle", "PARTIALLY_PROVEN", (input.evidence ?? []).map(() => "operator-evidence")) });
  }
  return { interpretation: bounded.finalOutput, observations: bounded.records.flatMap((record) => record.observations), uncertainty: missingEvidence.length ? ["Interpretation is bounded by missing evidence."] : [], missingEvidence, verificationState: bounded.decision === "ACCEPT" && bounded.terminationReason === "COMPLETE" ? "verified" : "bounded", cycles, receipt: bounded.receipt, bounded };
}
