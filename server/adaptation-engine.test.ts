import { describe, expect, it } from "vitest";
import { activateAdaptation, evaluateShadow, isProtectedVariable, proposeAdaptation, rollbackAdaptation, scoreLearningSignals } from "./adaptation-engine";

const evidence = [
  { type: "SUCCESSFUL_TASK" as const, value: 1, verified: true, contextKey: "technical" },
  { type: "VERIFIED_OUTCOME" as const, value: 1, verified: true, contextKey: "technical" },
  { type: "PERFORMANCE_METRIC" as const, value: 0.9, verified: true, contextKey: "technical" },
];

describe("Stage 6 controlled adaptive intelligence", () => {
  it("rejects single-sample adaptation and accepts sufficient verified evidence", () => {
    expect(scoreLearningSignals([evidence[0]], "technical").eligible).toBe(false);
    const result = proposeAdaptation({ variable: "routing_preference", currentState: "route-a", proposedState: "route-b", reason: "repeated verified technical outcomes", expectedEffect: "lower latency", risk: "LOW", evidence, contextKey: "technical" });
    expect(result.score.eligible).toBe(true);
    expect(result.proposal.mode).toBe("SHADOW");
    expect(result.proposal.approval).toBe("PENDING");
  });

  it("keeps proposed behavior in shadow mode until explicit operator authorization", () => {
    const proposal = proposeAdaptation({ variable: "model_selection", currentState: "local-a", proposedState: "local-b", reason: "verified benchmark advantage", expectedEffect: "improve task completion", risk: "LOW", evidence, contextKey: "technical" }).proposal;
    const shadow = evaluateShadow(proposal, { success: true, metric: 0.95 });
    expect(shadow.proposal.mode).toBe("SHADOW");
    expect(activateAdaptation(shadow.proposal, { approved: false, actor: "system", reason: "automatic approval" }).proposal.mode).toBe("REJECTED");
    const active = activateAdaptation(shadow.proposal, { approved: true, actor: "operator", reason: "Tyler approved after review" });
    expect(active.proposal.mode).toBe("ACTIVE");
    expect(active.receipt.operation).toBe("adaptation.activate");
  });

  it("supports rollback with the prior state and rollback receipt", () => {
    const proposal = proposeAdaptation({ variable: "response_strategy", currentState: "informative", proposedState: "concise", reason: "verified preference trend", expectedEffect: "reduce response latency", risk: "LOW", evidence, contextKey: "technical" }).proposal;
    const active = activateAdaptation(proposal, { approved: true, actor: "operator", reason: "approved" }).proposal;
    const rolledBack = rollbackAdaptation(active, "shadow metric regressed");
    expect(rolledBack.proposal.mode).toBe("ROLLED_BACK");
    expect(rolledBack.proposal.proposed_state).toBe("informative");
    expect(rolledBack.receipt.operation).toBe("adaptation.rollback");
  });

  it("protects security, identity, authority, credentials, and audit roots", () => {
    expect(isProtectedVariable("credentials")).toBe(true);
    expect(() => proposeAdaptation({ variable: "credentials" as never, currentState: "old", proposedState: "new", reason: "test", expectedEffect: "test", risk: "LOW", evidence, contextKey: "technical" })).toThrow("Protected variable");
    const highRisk = proposeAdaptation({ variable: "tool_selection", currentState: "safe", proposedState: "unsafe", reason: "test", expectedEffect: "test", risk: "HIGH", evidence, contextKey: "technical" }).proposal;
    expect(activateAdaptation(highRisk, { approved: true, actor: "operator", reason: "attempt" }).proposal.mode).toBe("REJECTED");
  });

  it("records failed shadow outcomes without promoting them", () => {
    const proposal = proposeAdaptation({ variable: "routing_preference", currentState: "route-a", proposedState: "route-b", reason: "test", expectedEffect: "test", risk: "LOW", evidence, contextKey: "technical" }).proposal;
    const shadow = evaluateShadow(proposal, { success: false, metric: 0.1 });
    expect(shadow.proposal.mode).toBe("SHADOW");
    expect(shadow.proposal.result).toContain("negative");
  });
});
