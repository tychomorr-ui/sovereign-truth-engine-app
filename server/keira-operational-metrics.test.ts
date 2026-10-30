import { beforeEach, describe, expect, it } from "vitest";
import { getKeiraOperationalState, recordKeiraRoute, resetKeiraOperationalMetrics } from "./keira-operational-metrics";

beforeEach(() => resetKeiraOperationalMetrics());

describe("KEIRA operational metrics", () => {
  it("counts routes and computes latency percentiles", () => {
    recordKeiraRoute({ route: "FAST_PATH", latencyMs: 3, cacheHit: false, error: false, confidence: 1 });
    recordKeiraRoute({ route: "MIST", latencyMs: 30, cacheHit: false, error: false, confidence: 0.95 });
    recordKeiraRoute({ route: "LLM", latencyMs: 90, cacheHit: false, error: false, confidence: 0.5 });
    recordKeiraRoute({ route: "CACHE", latencyMs: 5, cacheHit: true, error: false, confidence: 0.9 });
    const state = getKeiraOperationalState(new Date("2026-10-30T00:00:00.000Z"));
    expect(state.totalRequests).toBe(4);
    expect(state.fastPathRequests).toBe(1);
    expect(state.mistRequests).toBe(1);
    expect(state.llmRequests).toBe(1);
    expect(state.cacheHits).toBe(1);
    expect(state.latencyP50).toBe(30);
    expect(state.latencyP95).toBe(90);
    expect(state.stateHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports elevated errors and LLM escalation without changing routing", () => {
    for (let index = 0; index < 20; index += 1) {
      recordKeiraRoute({ route: "LLM", latencyMs: 10, cacheHit: false, error: index < 3, confidence: 0.5 });
    }
    const state = getKeiraOperationalState();
    expect(state.anomalyFlags).toContain("ERROR_RATE_ELEVATED");
    expect(state.anomalyFlags).toContain("LLM_ESCALATION_ELEVATED");
  });
});
