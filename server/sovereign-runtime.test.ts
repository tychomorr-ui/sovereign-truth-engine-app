import { describe, expect, it } from "vitest";
import { boundedPlan, detectContradictions, normalize } from "./deterministic-engine";
import { reflect } from "./reflection-engine";
import { SovereignMemory } from "./sovereign-memory";
import { getSovereignRuntimeStatus, resolveCapabilities, routeLocalConversation } from "./sovereign-bus";

describe("sovereign local runtime", () => {
  it("operates deterministically without an external provider", async () => {
    const result = await routeLocalConversation({ system: "test", messages: [{ role: "user", content: "hello" }], requested: "deterministic" });
    expect(result.status).toBe("ok");
    expect(result.external_fallback).toBe(false);
    expect(result.receipt.intelligence_mode).toBe("deterministic");
    expect(result.receipt.external_service_used).toBe(false);
    expect(result.receipt.data_left_local_node).toBe(false);
  });

  it("keeps external providers disabled and reports deterministic readiness", () => {
    const capabilities = resolveCapabilities();
    expect(capabilities.deterministic).toBe("READY");
    expect(capabilities.external_provider).toBe("DISABLED");
    expect(getSovereignRuntimeStatus("offline").offlineMode).toBe("AVAILABLE");
  });

  it("generates receipts for deterministic operations", () => {
    const output = normalize("  A   local   operation  ");
    expect(output.value?.output).toBe("A local operation");
    expect(output.receipt.operation).toBe("deterministic.normalize");
    expect(boundedPlan("ship the local runtime").receipt.result_state).toBe("PROVEN");
    expect(detectContradictions(["The model is ready", "The model is not ready"]).receipt.receipt_id).toBeTruthy();
  });

  it("terminates recursive reflection at the configured limit", () => {
    const output = reflect({ request: "inspect this", maxDepth: 2 });
    expect(output.cycles).toHaveLength(3);
    expect(output.cycles.at(-1)?.terminationCondition).toBe("depth >= 2");
    expect(output.receipt.intelligence_mode).toBe("deterministic");
  });

  it("requires explicit memory metadata and honors revocation", () => {
    const memory = new SovereignMemory();
    const written = memory.write({ class: "USER_AUTHORIZED_MEMORY", content: "local fact", source: "operator", authority: "operator", sensitivity: "private", retention: "until_revoked", provenance: "operator supplied" });
    expect(written.record?.revoked).toBe(false);
    memory.revoke(written.record!.id);
    expect(memory.read().records).toHaveLength(0);
    expect(written.receipt.data_left_local_node).toBe(false);
  });
});
