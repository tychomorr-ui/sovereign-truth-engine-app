import { describe, expect, it } from "vitest";
import { makeDecision, checkResourceLimits, classifyEvidence, evaluateTransition, listDeterministicCapabilities, recommendRecovery, validateInput } from "./deterministic-core";
import { resolveDeterministicCapability, routeDeterministic } from "./deterministic-bus";
import { canTransition } from "./truth-state";

describe("Stage 2 deterministic intelligence core", () => {
  it("routes deterministic capabilities without an LLM", () => {
    expect(listDeterministicCapabilities()).toContain("state_inspection");
    const routed = routeDeterministic({ capability: "input_validation", input: {} }, (input) => validateInput(input));
    expect(routed.ok).toBe(true);
    expect(routed.receipt.intelligence_mode).toBe("deterministic");
  });

  it("rejects malformed input and unavailable capabilities", () => {
    expect(validateInput(null).failure).toBe("MALFORMED_REQUEST");
    expect(resolveDeterministicCapability("not-a-capability").failure).toBe("CAPABILITY_UNAVAILABLE");
  });

  it("keeps unknown, stale, conflicted, and verified evidence distinct", () => {
    expect(classifyEvidence({ authorized: true }).value?.state).toBe("UNKNOWN");
    expect(classifyEvidence({ value: "old", stale: true, authorized: true }).failure).toBe("STALE_INFORMATION");
    expect(classifyEvidence({ value: "x", conflicted: true, authorized: true }).failure).toBe("CONFLICTING_EVIDENCE");
    expect(classifyEvidence({ value: "x", verified: true, authorized: true }).value?.state).toBe("KNOWN");
    expect(classifyEvidence({ value: "x", authorized: false }).value?.state).toBe("UNAUTHORIZED_TO_ACCESS");
  });

  it("enforces non-arbitrary truth-state transitions", () => {
    expect(canTransition("DECLARED", "VERIFIED").allowed).toBe(false);
    expect(evaluateTransition("DECLARED", "VERIFIED").failure).toBe("INVALID_STATE_TRANSITION");
    expect(evaluateTransition("DOCUMENTED", "VERIFIED").ok).toBe(true);
  });

  it("separates capability from authority and policy", () => {
    const denied = makeDecision({ intent: "inspect", actor: "operator:1", capability: "state_inspection", authorityPermitted: false, authorityReason: "no authority", policyAllowed: true, policyReason: "allowed" });
    expect(denied.failure).toBe("AUTHORITY_DENIED");
    const policy = makeDecision({ intent: "inspect", actor: "operator:1", capability: "state_inspection", authorityPermitted: true, authorityReason: "operator", policyAllowed: false, policyReason: "policy denied" });
    expect(policy.failure).toBe("POLICY_DENIED");
    const confirmation = makeDecision({ intent: "deploy", actor: "operator:1", capability: "request_routing", authorityPermitted: true, authorityReason: "operator", policyAllowed: true, policyReason: "allowed", consequential: true });
    expect(confirmation.value?.decision).toBe("REQUIRE_HUMAN_CONFIRMATION");
  });

  it("checks recursion, operation, timeout, and context budgets", () => {
    expect(checkResourceLimits({ recursionDepth: 6 }).failure).toBe("RECURSION_LIMIT");
    expect(checkResourceLimits({ operations: 101 }).failure).toBe("OPERATION_LIMIT");
    expect(checkResourceLimits({ elapsedMs: 2001 }).failure).toBe("TIMEOUT");
    expect(checkResourceLimits({ contextChars: 32001 }).failure).toBe("OPERATION_LIMIT");
    expect(checkResourceLimits({ recursionDepth: 1, operations: 1, elapsedMs: 1 }).ok).toBe(true);
  });

  it("classifies recoveries deterministically", () => {
    expect(recommendRecovery("CONFLICTING_EVIDENCE").action).toContain("adjudicate");
    expect(recommendRecovery("AUTHORITY_REQUIRED").requiresHuman).toBe(true);
    expect(recommendRecovery("TIMEOUT").retryable).toBe(true);
  });

  it("produces reproducible decisions apart from receipt identity and time", () => {
    const input = { intent: "inspect", actor: "operator:1", capability: "state_inspection" as const, authorityPermitted: true, authorityReason: "operator", policyAllowed: true, policyReason: "allowed", evidence: { value: "known", verified: true, authorized: true } };
    const first = makeDecision(input).value!;
    const second = makeDecision(input).value!;
    expect({ ...first, decision_id: undefined, timestamp: undefined, receipt_id: undefined }).toEqual({ ...second, decision_id: undefined, timestamp: undefined, receipt_id: undefined });
  });
});
