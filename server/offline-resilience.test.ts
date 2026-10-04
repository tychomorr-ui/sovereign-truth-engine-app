import { describe, expect, it } from "vitest";
import { getDegradationMatrix, OfflineResilienceController, stateForFailure } from "./offline-resilience";

describe("Stage 8 offline resilience and recovery", () => {
  it("maps all declared failure conditions to explicit degradation states", () => {
    expect(stateForFailure("NO_INTERNET")).toBe("OFFLINE");
    expect(stateForFailure("LOCAL_MODEL_OFFLINE")).toBe("DEGRADED");
    expect(stateForFailure("DATABASE_INTERRUPTION")).toBe("DEGRADED");
    expect(stateForFailure("POLICY_DENIAL")).toBe("BLOCKED");
    expect(getDegradationMatrix()).toHaveLength(13);
  });

  it("continues offline with deterministic capabilities without fake remote success", () => {
    const controller = new OfflineResilienceController();
    const failure = controller.setFailure("NO_INTERNET");
    expect(failure.state).toBe("OFFLINE");
    expect(controller.getState()).toBe("OFFLINE");
    expect(controller.getReceipts().at(-1)?.result_state).toBe("OFFLINE");
  });

  it("queues authorized non-expired work and prevents unauthorized or denied work", () => {
    const controller = new OfflineResilienceController();
    const queued = controller.queueAuthorizedWork({ idempotencyKey: "op-1", intent: "normalize local record", authority: "operator-1", policy: "local-only", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
    expect(queued.status).toBe("QUEUED");
    const unauthorized = controller.queueAuthorizedWork({ idempotencyKey: "op-2", intent: "run tool", authority: "none", policy: "local-only", requiredCapability: "local_tool", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: false, policyValid: true });
    expect(unauthorized.status).toBe("BLOCKED");
    const denied = controller.queueAuthorizedWork({ idempotencyKey: "op-3", intent: "run denied", authority: "operator-1", policy: "deny", requiredCapability: "tool", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: false });
    expect(denied.status).toBe("BLOCKED");
  });

  it("protects against duplicates, expiration, and revocation", () => {
    const controller = new OfflineResilienceController();
    const queued = controller.queueAuthorizedWork({ idempotencyKey: "duplicate", intent: "safe work", authority: "operator", policy: "allow", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
    expect(controller.queueAuthorizedWork({ idempotencyKey: "duplicate", intent: "safe work", authority: "operator", policy: "allow", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true }).status).toBe("DUPLICATE");
    expect(controller.revokeWork(queued.item!.id).status).toBe("REVOKED");
    expect(controller.validateForRecovery(queued.item!.id, { authorityValid: true, policyValid: true, dataValid: true }).valid).toBe(false);
    expect(controller.queueAuthorizedWork({ idempotencyKey: "expired", intent: "old work", authority: "operator", policy: "allow", requiredCapability: "deterministic", expiresAt: new Date(Date.now() - 1).toISOString(), authorityValid: true, policyValid: true }).status).toBe("EXPIRED");
  });

  it("recovers valid work once and never duplicates the side effect", () => {
    const controller = new OfflineResilienceController();
    const queued = controller.queueAuthorizedWork({ idempotencyKey: "recover-1", intent: "safe replay", authority: "operator", policy: "allow", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
    let executions = 0;
    const recovered = controller.recover(queued.item!.id, { authorityValid: true, policyValid: true, dataValid: true, execute: () => { executions += 1; return { success: true, resultState: "PROVEN" }; } });
    expect(recovered.status).toBe("COMPLETED");
    expect(executions).toBe(1);
    expect(controller.recover(queued.item!.id, { authorityValid: true, policyValid: true, dataValid: true, execute: () => { executions += 1; return { success: true, resultState: "PROVEN" }; } }).status).toBe("RECOVERY_BLOCKED");
    expect(executions).toBe(1);
  });

  it("preserves queue and receipt continuity across restart snapshots", () => {
    const first = new OfflineResilienceController();
    const queued = first.queueAuthorizedWork({ idempotencyKey: "restart-1", intent: "persisted offline work", authority: "operator", policy: "allow", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
    const second = new OfflineResilienceController();
    second.restore(first.snapshot());
    expect(second.validateForRecovery(queued.item!.id, { authorityValid: true, policyValid: true, dataValid: true }).valid).toBe(true);
    expect(second.getReceipts().length).toBe(first.getReceipts().length);
  });

  it("blocks recovery when data or authority changed and records controlled recovery state", () => {
    const controller = new OfflineResilienceController();
    const queued = controller.queueAuthorizedWork({ idempotencyKey: "changed", intent: "review", authority: "operator", policy: "allow", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
    controller.beginRecovery();
    const blocked = controller.recover(queued.item!.id, { authorityValid: false, policyValid: true, dataValid: false, execute: () => ({ success: true, resultState: "PROVEN" }) });
    expect(blocked.status).toBe("RECOVERY_BLOCKED");
    expect(controller.getState()).toBe("RECOVERY");
    controller.completeRecovery();
    expect(controller.getState()).toBe("FULL");
  });
});
