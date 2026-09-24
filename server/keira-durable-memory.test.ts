import { describe, expect, it } from "vitest";
import { createReceipt } from "./sovereign-bus";
import { recommendRecovery } from "./deterministic-core";

describe("durable provenance contracts", () => {
  it("keeps a durable receipt's generated inference state explicit", () => {
    const receipt = createReceipt({ operation: "conversation.generate", intelligence_mode: "local_model", provider: "ollama", model: "test-model", context_sources: ["operator"], policy: "local-only", verification: "generated inference; KEIRA verification required", result_state: "GENERATED_INFERENCE" });
    expect(receipt.result_state).toBe("GENERATED_INFERENCE");
    expect(receipt.external_service_used).toBe(false);
    expect(receipt.data_left_local_node).toBe(false);
  });

  it("does not turn durable persistence failures into authority", () => {
    expect(recommendRecovery("CAPABILITY_UNAVAILABLE").requiresHuman).toBe(false);
    expect(recommendRecovery("AUTHORITY_REQUIRED").requiresHuman).toBe(true);
  });
});
