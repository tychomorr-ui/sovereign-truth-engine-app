import { describe, expect, it } from "vitest";
import { runSovereignPipeline } from "./sovereign-pipeline";

describe("sovereign request pipeline", () => {
  it("executes the explicit lifecycle in order for an authorized non-consequential action", async () => {
    const result = await runSovereignPipeline({ operation: "test.inspect", intent: "inspect local state", actor: "operator:1", authority: "operator", policyApproved: true, requestedCapability: "deterministic" }, async (capability) => ({ capability, ok: true }));
    expect(result.status).toBe("COMPLETED");
    expect(result.trace.map((entry) => entry.stage)).toEqual(["INTENT", "CONTEXT", "CAPABILITY_DISCOVERY", "AUTHORIZATION", "POLICY", "PLAN", "EXECUTION", "EXECUTION", "REFLECTION", "VERIFICATION", "RECEIPT"]);
    expect(result.receipt.result_state).toBe("COMPLETED");
  });

  it("does not treat technical capability as authority", async () => {
    const result = await runSovereignPipeline({ operation: "test.write", intent: "write a file", actor: "operator:1", authority: "none", policyApproved: true, requestedCapability: "local_tool" }, async () => "should not run");
    expect(result.status).toBe("BLOCKED");
    expect(result.failure).toBe("AUTHORITY_REQUIRED");
  });

  it("requires human confirmation for consequential execution", async () => {
    const result = await runSovereignPipeline({ operation: "test.deploy", intent: "deploy release", actor: "operator:1", authority: "operator", consequential: true, policyApproved: true }, async () => "should not run");
    expect(result.status).toBe("BLOCKED");
    expect(result.failure).toBe("HUMAN_CONFIRMATION_REQUIRED");
  });

  it("fails closed when policy denies the action", async () => {
    const result = await runSovereignPipeline({ operation: "test.network", intent: "send data", actor: "operator:1", authority: "operator", policyApproved: false }, async () => "should not run");
    expect(result.status).toBe("BLOCKED");
    expect(result.failure).toBe("POLICY_DENIED");
    expect(result.receipt.result_state).toBe("POLICY_DENIED");
  });
});
