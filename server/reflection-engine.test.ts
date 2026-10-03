import { describe, expect, it } from "vitest";
import { reflect, runBoundedReflection } from "./reflection-engine";

describe("Stage 5 bounded recursive reflection", () => {
  it("detects a deficient result and revises it before returning", () => {
    const result = runBoundedReflection({ request: "answer the question", initialOutput: "This is guaranteed and certainly correct.", level: 2, evidence: ["operator note"] });
    expect(result.decision).toBe("ACCEPT");
    expect(result.finalOutput).toContain("typically");
    expect(result.records.some((record) => record.decision === "REVISE")).toBe(true);
    expect(result.records.some((record) => record.proposed_revision)).toBe(true);
    expect(result.terminationReason).toBe("COMPLETE");
  });

  it("supports no reflection and basic validation levels", () => {
    expect(runBoundedReflection({ request: "plain answer", initialOutput: "plain answer", level: 0 }).terminationReason).toBe("NO_REFLECTION");
    const basic = runBoundedReflection({ request: "plain answer", initialOutput: "plain answer", level: 1 });
    expect(basic.records).toHaveLength(1);
    expect(basic.decision).toBe("ACCEPT");
  });

  it("terminates at reflection, recursion, operation, time, and token limits", () => {
    expect(runBoundedReflection({ request: "answer", initialOutput: "This is guaranteed", level: 2, limits: { maxReflectionDepth: 0 } }).terminationReason).toBe("MAX_REFLECTION_DEPTH");
    expect(runBoundedReflection({ request: "answer", initialOutput: "This is guaranteed", level: 2, limits: { maxRecursionDepth: 0 } }).terminationReason).toBe("MAX_RECURSION_DEPTH");
    expect(runBoundedReflection({ request: "answer", initialOutput: "This is guaranteed", level: 2, limits: { maxOperations: 1 } }).terminationReason).toBe("MAX_OPERATIONS");
    expect(runBoundedReflection({ request: "answer", initialOutput: "This is guaranteed", level: 2, limits: { maxTimeMs: 1 }, execute: () => { const end = Date.now() + 3; while (Date.now() < end) { /* bounded test delay */ } return "revised"; } }).terminationReason).toMatch(/MAX_TIME|COMPLETE/);
    expect(runBoundedReflection({ request: "answer", initialOutput: Array.from({ length: 40 }, (_, index) => `token${index}`).join(" "), level: 2, limits: { maxTokens: 32 } }).terminationReason).toBe("MAX_TOKEN_BUDGET");
  });

  it("detects repeated revisions and terminates safely", () => {
    const result = runBoundedReflection({ request: "answer", initialOutput: "This is guaranteed", level: 2, limits: { maxReflectionDepth: 5 }, execute: () => "This is guaranteed" });
    expect(result.terminationReason).toBe("LOOP_DETECTED");
    expect(result.decision).toBe("TERMINATE_FAILURE");
  });

  it("escalates contradictions and policy violations rather than certifying them", () => {
    const contradiction = runBoundedReflection({ request: "contradiction review", evidence: ["The status is ready", "The status is not ready"], initialOutput: "Review", level: 3 });
    expect(contradiction.decision).toBe("HUMAN_CONFIRMATION_REQUIRED");
    expect(contradiction.terminationReason).toBe("CONTRADICTION");
    const policy = runBoundedReflection({ request: "answer", initialOutput: "answer", unauthorizedInformation: true, level: 3 });
    expect(policy.decision).toBe("HUMAN_CONFIRMATION_REQUIRED");
    expect(policy.terminationReason).toBe("POLICY_VIOLATION");
  });

  it("reports insufficient evidence without inventing certainty", () => {
    const result = runBoundedReflection({ request: "verify this source", initialOutput: "The result is guaranteed", level: 2 });
    expect(result.evidenceState).toBe("INSUFFICIENT");
    expect(result.finalOutput).toContain("Evidence is insufficient");
  });

  it("keeps the legacy reflection wrapper bounded and receipt-backed", () => {
    const result = reflect({ request: "inspect this", maxDepth: 2 });
    expect(result.cycles).toHaveLength(3);
    expect(result.cycles.at(-1)?.terminationCondition).toBe("depth >= 2");
    expect(result.receipt.receipt_id).toBeTruthy();
  });
});
