import { describe, expect, it } from "vitest";
import { runApexCanonical } from "./apex-canonical";
import { classifyEvidence, makeDecision } from "./deterministic-core";
import { boundedPlan, classify, compareState, detectContradictions, evaluatePolicy, normalize } from "./deterministic-engine";
import { createMemoryObject, assembleMinimumContext } from "./memory-fabric";
import { OfflineResilienceController } from "./offline-resilience";
import { runBoundedReflection } from "./reflection-engine";
import { resolveCapabilities, routeLocalConversation, validateReceipt } from "./sovereign-bus";

const operator = { identity: "baseline-operator", authority: "operator" as const, consent: true, revoked: false };

/**
 * Phase 1 preservation tripwires.
 *
 * These tests intentionally use only deterministic paths and in-memory state. They
 * must remain runnable with no configured model, no network access, and no database.
 * New MIST/corpus/Phoenix work may extend the runtime, but it must not weaken any
 * assertion below.
 */
describe("Phase 1 deterministic preservation baseline", () => {
  it("keeps deterministic transforms reproducible, local, and receipt-complete", () => {
    const normalized = normalize("  KEIRA\u00a0 local\nrequest  ").value!;
    expect(normalized.output).toBe("KEIRA local request");
    expect(normalized.receipt.intelligence_mode).toBe("deterministic");
    expect(normalized.receipt.external_service_used).toBe(false);
    expect(normalized.receipt.data_left_local_node).toBe(false);

    expect(classify("How do I configure a local runtime?").value?.output).toEqual({ category: "action" });
    expect(detectContradictions(["the node is ready", "the node is not ready"]).value?.output).toMatchObject({ detected: true });
    expect(boundedPlan("preserve deterministic behavior", 3).value?.output).toMatchObject({
      goal: "preserve deterministic behavior",
      steps: ["normalize the objective", "identify required inputs", "execute the smallest reversible action"],
    });
    expect(compareState({ mode: "deterministic" }, { mode: "deterministic" }).value?.output).toEqual({ changed: false, changes: [] });
    expect(evaluatePolicy({ action: "inspect", authorized: true, consequential: false }).value?.output).toMatchObject({ allowed: true });
  });

  it("keeps unknown distinct from false and separates capability, authority, policy, and execution", async () => {
    expect(classifyEvidence({ authorized: true }).value?.state).toBe("UNKNOWN");
    expect(makeDecision({
      intent: "inspect local state",
      actor: "baseline-operator",
      capability: "state_inspection",
      authorityPermitted: false,
      authorityReason: "missing authority",
      policyAllowed: true,
      policyReason: "allowed",
    }).failure).toBe("AUTHORITY_DENIED");

    const noAuthority = await runApexCanonical({
      intent: "inspect local state",
      actor: "baseline-operator",
      authority: { ...operator, authority: "none" },
    });
    expect(noAuthority.status).toBe("BLOCKED");
    expect(noAuthority.failure).toBe("AUTHORITY_REQUIRED");
    expect(noAuthority.receipt.result_state).toBe("AUTHORITY_REQUIRED");

    const policyDenied = await runApexCanonical({
      intent: "inspect local state",
      actor: "baseline-operator",
      authority: operator,
      policy: { execution: "DENY" },
    });
    expect(policyDenied.status).toBe("BLOCKED");
    expect(policyDenied.failure).toBe("POLICY_DENIED");
  });

  it("does not silently escalate deterministic conversation requests to an external provider", async () => {
    const response = await routeLocalConversation({
      system: "Preserve local-only operation.",
      messages: [{ role: "user", content: "organize this request" }],
      requested: "deterministic",
      operation: "baseline.deterministic",
      contextSources: ["operator-supplied"],
    });

    expect(response.status).toBe("ok");
    expect(response.external_fallback).toBe(false);
    expect(response.value?.provider).toBe("deterministic");
    expect(response.receipt.intelligence_mode).toBe("deterministic");
    expect(response.receipt.external_service_used).toBe(false);
    expect(response.receipt.data_left_local_node).toBe(false);
    expect(response.receipt.policy).toContain("external providers disabled");
    expect(validateReceipt(response.receipt)).toEqual({ valid: true, reason: "receipt contract complete" });

    const capabilities = resolveCapabilities();
    expect(capabilities.deterministic).toBe("READY");
    expect(capabilities.external_provider).toBe("DISABLED");
  });

  it("keeps generated certainty bounded and requires human review for contradictions", () => {
    const revised = runBoundedReflection({
      request: "verify the status",
      initialOutput: "The status is guaranteed and certainly correct.",
      evidence: ["operator supplied note"],
      level: 2,
    });
    expect(revised.finalOutput).toContain("typically");
    expect(revised.finalOutput).not.toMatch(/guaranteed|certainly/i);
    expect(revised.receipt.intelligence_mode).toBe("deterministic");

    const conflicted = runBoundedReflection({
      request: "contradiction review",
      initialOutput: "review required",
      evidence: ["the status is ready", "the status is not ready"],
      level: 3,
    });
    expect(conflicted.decision).toBe("HUMAN_CONFIRMATION_REQUIRED");
    expect(conflicted.terminationReason).toBe("CONTRADICTION");
  });

  it("prevents inferred claims from entering evidence context and preserves conflict visibility", () => {
    expect(() => createMemoryObject({
      type: "EVIDENCE",
      content: "unsupported model claim",
      subject: "status",
      source: "local-model",
      provenance: { type: "INFERENCE", description: "generated", related_receipts: [] },
      information_state: "INFERRED",
      confidence: 1,
      authority: "derived",
      visibility: "private",
      retention: "session",
      expiration: null,
      related_receipts: [],
      supersedes: null,
      superseded_by: null,
      scope: "baseline",
    })).toThrow("cannot be stored as evidence");

    const first = createMemoryObject({
      type: "DURABLE_MEMORY",
      content: "the node is ready",
      subject: "node status",
      source: "operator",
      provenance: { type: "USER", description: "operator statement", related_receipts: [] },
      information_state: "KNOWN",
      confidence: 100,
      authority: "operator",
      visibility: "private",
      retention: "until_revoked",
      expiration: null,
      related_receipts: [],
      supersedes: null,
      superseded_by: null,
      scope: "baseline",
    });
    const second = createMemoryObject({ ...first, memory_id: "00000000-0000-4000-8000-000000000001", content: "the node is not ready", source: "verified-record" });
    const assembly = assembleMinimumContext({ intent: "node status", memories: [first, second] });
    expect(assembly.included).toHaveLength(0);
    expect(assembly.unavailable.some((reason) => reason.includes("requires human review"))).toBe(true);
  });

  it("keeps offline recovery authorized, idempotent, and free of fabricated remote success", async () => {
    const controller = new OfflineResilienceController();
    expect(controller.setFailure("NO_INTERNET").state).toBe("OFFLINE");

    const queued = controller.queueAuthorizedWork({
      idempotencyKey: "baseline-offline-work",
      intent: "normalize local record",
      authority: "baseline-operator",
      policy: "local-only",
      requiredCapability: "deterministic",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      authorityValid: true,
      policyValid: true,
    });
    expect(queued.status).toBe("QUEUED");

    const local = await routeLocalConversation({
      system: "Offline deterministic continuation.",
      messages: [{ role: "user", content: "continue locally" }],
      requested: "deterministic",
      operation: "baseline.offline",
    });
    expect(local.receipt.external_service_used).toBe(false);

    let executions = 0;
    const firstRecovery = controller.recover(queued.item!.id, {
      authorityValid: true,
      policyValid: true,
      dataValid: true,
      execute: () => {
        executions += 1;
        return { success: true, resultState: "PROVEN" };
      },
    });
    expect(firstRecovery.status).toBe("COMPLETED");
    expect(executions).toBe(1);
    expect(controller.recover(queued.item!.id, {
      authorityValid: true,
      policyValid: true,
      dataValid: true,
      execute: () => {
        executions += 1;
        return { success: true, resultState: "PROVEN" };
      },
    }).status).toBe("RECOVERY_BLOCKED");
    expect(executions).toBe(1);
  });
});
