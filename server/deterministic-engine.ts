import { createReceipt, type IntelligenceReceipt, type IntelligenceResult } from "./sovereign-bus";

export type DeterministicOperation = "normalize" | "classify" | "rule_evaluate" | "structured_transform" | "contradiction_detection" | "confidence" | "state_compare" | "bounded_plan" | "policy_evaluate" | "evidence_transition" | "consistency_check";

export type DeterministicValue = {
  operation: DeterministicOperation;
  input: unknown;
  output: unknown;
  confidence: number;
  receipt: IntelligenceReceipt;
};

function result(operation: DeterministicOperation, input: unknown, output: unknown, confidence: number, verification: string): IntelligenceResult<DeterministicValue> {
  const receipt = createReceipt({ operation: `deterministic.${operation}`, intelligence_mode: "deterministic", provider: "deterministic-engine", model: null, context_sources: [], policy: "deterministic lane; no model inference", verification, result_state: "PROVEN" });
  return { status: "ok", value: { operation, input, output, confidence, receipt }, external_fallback: false, receipt };
}

export function normalize(value: string): IntelligenceResult<DeterministicValue> {
  const output = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  return result("normalize", value, output, output ? 1 : 0.5, "normalized locally without model inference");
}

export function classify(value: string): IntelligenceResult<DeterministicValue> {
  const normalized = value.toLowerCase();
  const category = /\b(how|build|implement|configure|deploy)\b/.test(normalized) ? "action" : /\b(why|meaning|reflect|pattern)\b/.test(normalized) ? "reflection" : /\b(compare|versus|difference)\b/.test(normalized) ? "comparison" : "general";
  return result("classify", value, { category }, 0.8, "classified by deterministic lexical rules");
}

export function detectContradictions(statements: string[]): IntelligenceResult<DeterministicValue> {
  const normalized = statements.map((statement) => statement.toLowerCase().trim());
  const contradictions: Array<{ positive: string; negative: string }> = [];
  for (const statement of normalized) {
    const without = statement.replace(/\bnot\b|\bnever\b|\bno\b/g, "").replace(/\s+/g, " ").trim();
    const opposite = normalized.find((candidate) => candidate !== statement && candidate.replace(/\bnot\b|\bnever\b|\bno\b/g, "").replace(/\s+/g, " ").trim() === without);
    if (opposite) contradictions.push({ positive: statement, negative: opposite });
  }
  const unique = contradictions.filter((item, index, items) => index === items.findIndex((candidate) => candidate.positive === item.positive && candidate.negative === item.negative));
  return result("contradiction_detection", statements, { contradictions: unique, detected: unique.length > 0 }, unique.length > 0 ? 0.7 : 0.95, "compared normalized statements using bounded lexical rules");
}

export function boundedPlan(goal: string, maxSteps = 5): IntelligenceResult<DeterministicValue> {
  const steps = ["normalize the objective", "identify required inputs", "execute the smallest reversible action", "check the result", "record evidence"].slice(0, Math.max(1, Math.min(10, maxSteps)));
  return result("bounded_plan", goal, { goal: goal.trim(), steps }, 0.75, "generated a fixed-depth bounded plan without model inference");
}

export function evaluatePolicy(input: { action: string; authorized: boolean; consequential?: boolean }): IntelligenceResult<DeterministicValue> {
  const allowed = input.authorized && !input.consequential;
  return result("policy_evaluate", input, { allowed, reason: allowed ? "authorized non-consequential action" : "requires explicit authority or protected workflow" }, allowed ? 0.95 : 1, "evaluated explicit authorization and consequence flags");
}

export function compareState(previous: Record<string, unknown>, current: Record<string, unknown>): IntelligenceResult<DeterministicValue> {
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes = Array.from(keys).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(current[key])).map((key) => ({ key, previous: previous[key] ?? null, current: current[key] ?? null }));
  return result("state_compare", { previous, current }, { changed: changes.length > 0, changes }, 0.99, "compared serialized local state");
}
