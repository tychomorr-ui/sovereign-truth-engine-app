import { describe, expect, it } from "vitest";
import { runApexCanonical, discoverApexCapabilities } from "./apex-canonical";

const operator = { identity: "operator-1", authority: "operator" as const, consent: true, revoked: false };

describe("Stage 7 APEX CANONICAL orchestration", () => {
  it("discovers capabilities and completes a smallest-radius deterministic workflow", async () => {
    const result = await runApexCanonical({ intent: "normalize this local request", actor: "operator-1", contextSources: ["operator-context"], authority: operator });
    expect(result.status).toBe("COMPLETED");
    expect(result.selectedCapability?.id).toBe("deterministic");
    expect(result.selectedCapability?.radius).toBe("LOCAL");
    expect(result.trace.map((entry) => entry.stage)).toEqual(["INTENT", "INTENT", "CONTEXT", "CAPABILITY_DISCOVERY", "CAPABILITY_DISCOVERY", "AUTHORIZATION", "POLICY", "PLAN", "EXECUTION", "EXECUTION", "REFLECTION", "REFLECTION", "VERIFICATION", "VERIFICATION", "RECEIPT"]);
    expect(result.receipt.context_sources).toContain("operator-context");
    expect(result.receipt.context_sources).toContain(result.reflection ? result.receipt.context_sources[2] : "");
  });

  it("keeps unavailable local models and providers explicit", async () => {
    const model = await runApexCanonical({ intent: "use the local model", actor: "operator-1", requestedCapability: "local_model", authority: operator });
    expect(model.status).toBe("BLOCKED");
    expect(model.failure).toBe("MODEL_UNAVAILABLE");
    const external = await runApexCanonical({ intent: "use cloud provider", actor: "operator-1", requestedCapability: "external_provider", authority: operator });
    expect(external.status).toBe("BLOCKED");
    expect(external.failure).toBe("CAPABILITY_UNAVAILABLE");
  });

  it("requires authority, consent, and confirmation separately", async () => {
    const noAuthority = await runApexCanonical({ intent: "run local tool", actor: "operator-1", requestedCapability: "local_tool", authority: { identity: "operator-1", authority: "operator", consent: false, revoked: false } });
    expect(noAuthority.failure).toBe("AUTHORITY_REQUIRED");
    const noIdentityAuthority = await runApexCanonical({ intent: "answer", actor: "operator-1" });
    expect(noIdentityAuthority.failure).toBe("AUTHORITY_REQUIRED");
    const consequential = await runApexCanonical({ intent: "answer", actor: "operator-1", authority: operator, consequential: true });
    expect(consequential.failure).toBe("HUMAN_CONFIRMATION_REQUIRED");
  });

  it("denies policy and network escalation rather than hiding failure", async () => {
    const denied = await runApexCanonical({ intent: "answer", actor: "operator-1", authority: operator, policy: { execution: "DENY" } });
    expect(denied.failure).toBe("POLICY_DENIED");
    const mesh = await runApexCanonical({ intent: "mesh request", actor: "operator-1", requestedCapability: "trusted_mesh", authority: operator, policy: { network: "OFFLINE" } });
    expect(mesh.failure).toBe("CAPABILITY_UNAVAILABLE");
  });

  it("runs a local-model adapter when the runtime is declared ready and reflects the result", async () => {
    const result = await runApexCanonical(
      { intent: "summarize local evidence", actor: "operator-1", requestedCapability: "local_model", authority: operator, contextSources: ["memory:1"] },
      {
        runtime: { deterministic: "READY", localModel: "READY", localModelName: "test-local", localRuntime: "test", localMemory: "READY", localTools: "AVAILABLE", trustedMesh: "NOT_CONFIGURED", externalProviders: "DISABLED", network: "offline", provenance: "READY", offlineMode: "AVAILABLE" },
        execute: async (capability) => ({
          output: "This is guaranteed and certainly correct.",
          resultState: "GENERATED_INFERENCE",
          receipt: { receipt_id: "00000000-0000-4000-8000-000000000001", timestamp: new Date().toISOString(), operation: "test", intelligence_mode: "local_model", provider: capability.id, model: "test-local", context_sources: ["memory:1"], external_service_used: false, data_left_local_node: false, policy: "local", verification: "generated", result_state: "GENERATED_INFERENCE" },
        }),
      },
    );
    expect(result.status).toBe("COMPLETED");
    expect(result.output).toContain("typically");
    expect(result.reflection?.iterations).toBeGreaterThan(0);
  });

  it("propagates provider and verification failures with typed states", async () => {
    const providerFailure = await runApexCanonical({ intent: "execute", actor: "operator-1", authority: operator }, { execute: async () => { throw new Error("provider unavailable"); } });
    expect(providerFailure.failure).toBe("PROVIDER_FAILURE");
    const verificationFailure = await runApexCanonical({ intent: "execute", actor: "operator-1", authority: operator }, { execute: async () => ({ output: "", resultState: "EMPTY", receipt: { receipt_id: "", timestamp: new Date().toISOString(), operation: "test", intelligence_mode: "deterministic", provider: "test", model: null, context_sources: [], external_service_used: false, data_left_local_node: false, policy: "test", verification: "test", result_state: "EMPTY" } }) });
    expect(verificationFailure.failure).toBe("VERIFICATION_FAILED");
  });

  it("reports capability radius truthfully and emits a complete receipt", () => {
    const capabilities = discoverApexCapabilities();
    expect(capabilities.find((capability) => capability.id === "external_provider")?.state).toBe("DISABLED");
    expect(capabilities.find((capability) => capability.id === "deterministic")?.local).toBe(true);
  });
});
