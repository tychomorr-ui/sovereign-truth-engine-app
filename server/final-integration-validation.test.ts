import { describe, expect, it } from "vitest";
import { runFinalIntegrationValidation } from "./final-integration-validation";

describe("Final KEIRA integration validation", () => {
  it("executes all requested scenarios successfully", async () => {
    const report = await runFinalIntegrationValidation();
    expect(report.scenarios).toHaveLength(15);
    expect(report.scenarios.every((scenario) => scenario.pass)).toBe(true);
    expect(report.scenarios.every((scenario) => scenario.stages.length > 0 && scenario.receipts.length > 0)).toBe(true);
  });

  it("holds the declared runtime invariants and exposes composition boundaries", async () => {
    const report = await runFinalIntegrationValidation();
    expect(report.invariants).toHaveLength(13);
    expect(report.invariants.every((invariant) => invariant.holds)).toBe(true);
    expect(report.architecture.apexInvokesReflection).toBe(true);
    expect(report.architecture.apexInvokesReceipts).toBe(true);
    expect(report.architecture.apexInvokesMemory).toBe(false);
    expect(report.architecture.apexInvokesAdaptation).toBe(false);
  });
});
