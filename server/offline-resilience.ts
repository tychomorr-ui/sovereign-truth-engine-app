import { randomUUID } from "node:crypto";
import { createReceipt, type IntelligenceReceipt } from "./sovereign-bus";

export type DegradedState = "FULL" | "DEGRADED" | "OFFLINE" | "RECOVERY" | "BLOCKED";
export type FailureCondition = "NO_INTERNET" | "LOCAL_MODEL_OFFLINE" | "OLLAMA_FAILURE" | "LLAMA_CPP_FAILURE" | "VLLM_FAILURE" | "EXTERNAL_PROVIDER_FAILURE" | "DATABASE_INTERRUPTION" | "MESH_UNAVAILABLE" | "TOOL_UNAVAILABLE" | "INSUFFICIENT_AUTHORITY" | "POLICY_DENIAL" | "INVALID_INPUT" | "CONFLICTING_EVIDENCE";
export type QueueStatus = "QUEUED" | "EXPIRED" | "REVOKED" | "BLOCKED" | "COMPLETED" | "DUPLICATE";
export type RetryPolicy = { maxAttempts: number; backoffMs: number };
export type OfflineWorkItem = { id: string; idempotencyKey: string; intent: string; authority: string; policy: string; createdAt: string; requiredCapability: string; status: QueueStatus; expiresAt: string; retryPolicy: RetryPolicy; attempts: number; receiptId: string; consequential: boolean };
export type RecoveryValidation = { authorityValid: boolean; policyValid: boolean; dataValid: boolean; notExpired: boolean; notCompleted: boolean; noDuplicateSideEffect: boolean; valid: boolean; reason: string };
export type DegradationMatrixRow = { failure: FailureCondition; affectedCapability: string; remainingCapability: string; expectedBehavior: string; recoveryMethod: string };

const MATRIX: DegradationMatrixRow[] = [
  { failure: "NO_INTERNET", affectedCapability: "network, mesh, external providers", remainingCapability: "deterministic, local memory, local policy, receipts", expectedBehavior: "enter OFFLINE; do not fabricate remote data", recoveryMethod: "recheck network, then controlled recovery" },
  { failure: "LOCAL_MODEL_OFFLINE", affectedCapability: "local model", remainingCapability: "deterministic runtime", expectedBehavior: "return explicit model unavailability or deterministic fallback when permitted", recoveryMethod: "health-check configured runtime" },
  { failure: "OLLAMA_FAILURE", affectedCapability: "Ollama adapter", remainingCapability: "deterministic and other configured local adapters", expectedBehavior: "mark adapter unavailable; no fake model output", recoveryMethod: "retry health check with bounded backoff" },
  { failure: "LLAMA_CPP_FAILURE", affectedCapability: "llama.cpp adapter", remainingCapability: "deterministic and other configured local adapters", expectedBehavior: "mark adapter unavailable", recoveryMethod: "restart adapter under operator control" },
  { failure: "VLLM_FAILURE", affectedCapability: "vLLM adapter", remainingCapability: "deterministic and other configured local adapters", expectedBehavior: "mark adapter unavailable", recoveryMethod: "health-check and controlled restart" },
  { failure: "EXTERNAL_PROVIDER_FAILURE", affectedCapability: "external provider", remainingCapability: "all local capabilities", expectedBehavior: "external provider remains unavailable; no silent escalation", recoveryMethod: "provider health check and explicit reauthorization" },
  { failure: "DATABASE_INTERRUPTION", affectedCapability: "durable writes and reads", remainingCapability: "bounded in-memory operation only", expectedBehavior: "block persistence-dependent work; never claim durable success", recoveryMethod: "reconnect and verify schema before recovery" },
  { failure: "MESH_UNAVAILABLE", affectedCapability: "trusted mesh", remainingCapability: "local capabilities", expectedBehavior: "remain local/offline", recoveryMethod: "mesh health check" },
  { failure: "TOOL_UNAVAILABLE", affectedCapability: "requested tool", remainingCapability: "deterministic reasoning and available local tools", expectedBehavior: "return TOOL_UNAVAILABLE", recoveryMethod: "tool health check" },
  { failure: "INSUFFICIENT_AUTHORITY", affectedCapability: "authorized execution", remainingCapability: "read-only inspection", expectedBehavior: "BLOCKED; do not queue", recoveryMethod: "obtain fresh explicit authority" },
  { failure: "POLICY_DENIAL", affectedCapability: "denied operation", remainingCapability: "policy-compliant operations", expectedBehavior: "BLOCKED; do not retry blindly", recoveryMethod: "policy review" },
  { failure: "INVALID_INPUT", affectedCapability: "requested operation", remainingCapability: "none for malformed request", expectedBehavior: "BLOCKED", recoveryMethod: "correct input" },
  { failure: "CONFLICTING_EVIDENCE", affectedCapability: "verification", remainingCapability: "human review and local inspection", expectedBehavior: "BLOCKED or HUMAN_CONFIRMATION_REQUIRED", recoveryMethod: "resolve evidence conflict" },
];

function receipt(operation: string, state: string, sources: string[] = []): IntelligenceReceipt { return createReceipt({ operation, intelligence_mode: "deterministic", provider: "offline-resilience", model: null, context_sources: sources, policy: "no fake success; expired/revoked work is not replayed", verification: state, result_state: state }); }

export function getDegradationMatrix(): DegradationMatrixRow[] { return MATRIX.map((row) => ({ ...row })); }
export function stateForFailure(failure?: FailureCondition): DegradedState { if (!failure) return "FULL"; if (failure === "NO_INTERNET" || failure === "MESH_UNAVAILABLE" || failure === "EXTERNAL_PROVIDER_FAILURE") return "OFFLINE"; if (failure === "INSUFFICIENT_AUTHORITY" || failure === "POLICY_DENIAL" || failure === "INVALID_INPUT" || failure === "CONFLICTING_EVIDENCE") return "BLOCKED"; if (failure === "DATABASE_INTERRUPTION") return "DEGRADED"; return "DEGRADED"; }

export class OfflineResilienceController {
  private state: DegradedState = "FULL";
  private readonly queue = new Map<string, OfflineWorkItem>();
  private readonly completed = new Set<string>();
  private readonly revoked = new Set<string>();
  private readonly receipts: IntelligenceReceipt[] = [];

  getState(): DegradedState { return this.state; }
  setFailure(failure: FailureCondition): { state: DegradedState; failure: FailureCondition; receipt: IntelligenceReceipt } { this.state = stateForFailure(failure); const event = receipt("resilience.failure", this.state, [failure]); this.receipts.push(event); return { state: this.state, failure, receipt: event }; }
  beginRecovery(): IntelligenceReceipt { this.state = "RECOVERY"; const event = receipt("resilience.recovery.begin", "RECOVERY", []); this.receipts.push(event); return event; }
  completeRecovery(): IntelligenceReceipt { this.state = "FULL"; const event = receipt("resilience.recovery.complete", "FULL", []); this.receipts.push(event); return event; }
  getReceipts(): IntelligenceReceipt[] { return [...this.receipts]; }
  snapshot(): string { return JSON.stringify({ state: this.state, queue: Array.from(this.queue.values()), completed: Array.from(this.completed), revoked: Array.from(this.revoked), receipts: this.receipts }); }
  restore(snapshot: string): void { const parsed = JSON.parse(snapshot) as { state: DegradedState; queue: OfflineWorkItem[]; completed: string[]; revoked: string[]; receipts: IntelligenceReceipt[] }; this.state = parsed.state; this.queue.clear(); parsed.queue.forEach((item) => this.queue.set(item.id, item)); this.completed.clear(); parsed.completed.forEach((key) => this.completed.add(key)); this.revoked.clear(); parsed.revoked.forEach((key) => this.revoked.add(key)); this.receipts.length = 0; this.receipts.push(...parsed.receipts); }

  queueAuthorizedWork(input: { idempotencyKey: string; intent: string; authority: string; policy: string; requiredCapability: string; expiresAt: string; retryPolicy?: RetryPolicy; consequential?: boolean; authorityValid?: boolean; policyValid?: boolean }): { item?: OfflineWorkItem; status: QueueStatus; receipt: IntelligenceReceipt } {
    if (!input.intent.trim() || !input.authorityValid) return { status: "BLOCKED", receipt: receipt("resilience.queue", "INSUFFICIENT_AUTHORITY") };
    if (!input.policyValid) return { status: "BLOCKED", receipt: receipt("resilience.queue", "POLICY_DENIED") };
    if (new Date(input.expiresAt).getTime() <= Date.now()) return { status: "EXPIRED", receipt: receipt("resilience.queue", "EXPIRED") };
    if (this.completed.has(input.idempotencyKey) || Array.from(this.queue.values()).some((item) => item.idempotencyKey === input.idempotencyKey && item.status === "QUEUED")) return { status: "DUPLICATE", receipt: receipt("resilience.queue", "DUPLICATE", [input.idempotencyKey]) };
    const item: OfflineWorkItem = { id: randomUUID(), idempotencyKey: input.idempotencyKey, intent: input.intent.trim(), authority: input.authority, policy: input.policy, createdAt: new Date().toISOString(), requiredCapability: input.requiredCapability, status: "QUEUED", expiresAt: input.expiresAt, retryPolicy: input.retryPolicy ?? { maxAttempts: 3, backoffMs: 1000 }, attempts: 0, receiptId: "", consequential: Boolean(input.consequential) };
    const event = receipt("resilience.queue", "QUEUED", [item.id]); item.receiptId = event.receipt_id; this.queue.set(item.id, item); this.receipts.push(event); return { item, status: "QUEUED", receipt: event };
  }

  revokeWork(id: string): { status: QueueStatus; receipt: IntelligenceReceipt } { const item = this.queue.get(id); if (!item) return { status: "BLOCKED", receipt: receipt("resilience.revoke", "NOT_FOUND", [id]) }; item.status = "REVOKED"; this.revoked.add(item.idempotencyKey); const event = receipt("resilience.revoke", "REVOKED", [id]); this.receipts.push(event); return { status: "REVOKED", receipt: event }; }

  validateForRecovery(itemId: string, input: { authorityValid: boolean; policyValid: boolean; dataValid: boolean; now?: number }): RecoveryValidation { const item = this.queue.get(itemId); if (!item) return { authorityValid: false, policyValid: false, dataValid: false, notExpired: false, notCompleted: false, noDuplicateSideEffect: false, valid: false, reason: "queue item not found" }; const notExpired = new Date(item.expiresAt).getTime() > (input.now ?? Date.now()); const notCompleted = item.status === "QUEUED" && !this.completed.has(item.idempotencyKey); const noDuplicateSideEffect = !this.completed.has(item.idempotencyKey) && !this.revoked.has(item.idempotencyKey); const valid = input.authorityValid && input.policyValid && input.dataValid && notExpired && notCompleted && noDuplicateSideEffect; return { authorityValid: input.authorityValid, policyValid: input.policyValid, dataValid: input.dataValid, notExpired, notCompleted, noDuplicateSideEffect, valid, reason: valid ? "recovery checks passed" : "recovery blocked by authority, policy, data, expiry, revocation, or duplicate protection" }; }

  recover(itemId: string, input: { authorityValid: boolean; policyValid: boolean; dataValid: boolean; execute: (item: OfflineWorkItem) => { success: boolean; resultState: string } }): { status: QueueStatus | "RECOVERY_BLOCKED"; resultState: string; receipt: IntelligenceReceipt } { const item = this.queue.get(itemId); const validation = this.validateForRecovery(itemId, input); if (!item || !validation.valid) return { status: "RECOVERY_BLOCKED", resultState: validation.reason, receipt: receipt("resilience.recovery", "RECOVERY_BLOCKED", [itemId]) }; item.attempts += 1; const result = input.execute(item); if (!result.success) { if (item.attempts >= item.retryPolicy.maxAttempts) item.status = "BLOCKED"; const event = receipt("resilience.recovery", result.resultState, [item.id, item.receiptId]); this.receipts.push(event); return { status: item.status, resultState: result.resultState, receipt: event }; } item.status = "COMPLETED"; this.completed.add(item.idempotencyKey); const event = receipt("resilience.recovery", "COMPLETED", [item.id, item.receiptId]); this.receipts.push(event); return { status: "COMPLETED", resultState: result.resultState, receipt: event }; }
}
