import { randomUUID } from "node:crypto";
import type { IntelligenceReceipt } from "./sovereign-bus";

export const MEMORY_TYPES = ["WORKING_MEMORY", "SESSION_MEMORY", "DURABLE_MEMORY", "USER_AUTHORIZED_PREFERENCE", "SYSTEM_STATE", "OPERATIONAL_HISTORY", "EVIDENCE", "PROVENANCE", "ADAPTIVE_CONFIGURATION", "REVOKED_MEMORY"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];
export type ProvenanceType = "USER" | "SYSTEM" | "TOOL" | "LOCAL_MODEL" | "EXTERNAL_MODEL" | "FILE" | "DATABASE" | "OBSERVATION" | "VERIFIED_RECORD" | "INFERENCE";
export type MemoryVisibility = "private" | "shared" | "system";
export type MemoryStatus = "ACTIVE" | "REVOKED" | "EXPIRED" | "SUPERSEDED" | "CONFLICTED";

export type MemoryObject = {
  memory_id: string;
  type: MemoryType;
  content: string;
  subject: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  provenance: { type: ProvenanceType; description: string; related_receipts: string[] };
  information_state: "KNOWN" | "UNKNOWN" | "INFERRED" | "CONFLICTED" | "STALE" | "UNAVAILABLE";
  confidence: number;
  authority: "operator" | "system" | "derived";
  visibility: MemoryVisibility;
  retention: "turn" | "session" | "until_revoked" | "system";
  expiration: string | null;
  revocation: { status: MemoryStatus; revoked_at: string | null; reason: string | null };
  related_receipts: string[];
  supersedes: string | null;
  superseded_by: string | null;
  scope: string;
};

export type MemoryConflict = { conflict_id: string; items: string[]; sources: string[]; timestamps: string[]; authority: string[]; resolution_state: "OPEN" | "RESOLVED" | "DISMISSED"; resolution_method: string | null; human_review_required: boolean };
export type ContextAssembly = { intent: string; included: MemoryObject[]; evidence: MemoryObject[]; systemState: MemoryObject[]; policy: string[]; tools: string[]; irrelevant: MemoryObject[]; unavailable: string[]; suppliedMemoryIds: string[]; contextText: string; receiptIds: string[] };

export function assertMemoryAuthority(input: Pick<MemoryObject, "type" | "authority" | "provenance" | "information_state">): void {
  if (input.type === "USER_AUTHORIZED_PREFERENCE" && input.authority !== "operator") throw new Error("USER_AUTHORIZED_PREFERENCE requires operator authority.");
  if (input.type === "EVIDENCE" && input.information_state === "INFERRED") throw new Error("Inferred information cannot be stored as evidence.");
  if (input.provenance.type === "INFERENCE" && input.information_state === "KNOWN") throw new Error("Inference provenance cannot be classified as known without verification.");
  if (input.type === "DURABLE_MEMORY" && input.authority === "derived" && input.provenance.type !== "USER" && input.provenance.type !== "VERIFIED_RECORD") throw new Error("Derived durable memory requires explicit user or verified-record provenance.");
}

export function createMemoryObject(input: Omit<MemoryObject, "memory_id" | "created_at" | "updated_at" | "revocation"> & Partial<Pick<MemoryObject, "memory_id" | "created_at" | "updated_at">>): MemoryObject {
  assertMemoryAuthority(input);
  const now = new Date().toISOString();
  return { ...input, memory_id: input.memory_id ?? randomUUID(), created_at: input.created_at ?? now, updated_at: input.updated_at ?? now, revocation: { status: "ACTIVE", revoked_at: null, reason: null } };
}

export function revokeMemory(memory: MemoryObject, reason: string): MemoryObject {
  return { ...memory, updated_at: new Date().toISOString(), revocation: { status: "REVOKED", revoked_at: new Date().toISOString(), reason }, type: "REVOKED_MEMORY" };
}

export function expireMemory(memory: MemoryObject, now = new Date()): MemoryObject {
  if (!memory.expiration || new Date(memory.expiration) > now || memory.revocation.status !== "ACTIVE") return memory;
  return { ...memory, updated_at: now.toISOString(), revocation: { status: "EXPIRED", revoked_at: now.toISOString(), reason: "retention expiration" } };
}

export function supersedeMemory(oldMemory: MemoryObject, replacementId: string): MemoryObject {
  return { ...oldMemory, updated_at: new Date().toISOString(), superseded_by: replacementId, revocation: { status: "SUPERSEDED", revoked_at: null, reason: "superseded by newer memory" } };
}

export function detectMemoryConflicts(items: MemoryObject[]): MemoryConflict[] {
  const bySubject = new Map<string, MemoryObject[]>();
  for (const item of items.filter((candidate) => candidate.revocation.status === "ACTIVE" && candidate.subject)) {
    const group = bySubject.get(item.subject!) ?? [];
    group.push(item);
    bySubject.set(item.subject!, group);
  }
  return Array.from(bySubject.values()).filter((group) => new Set(group.map((item) => item.content.trim())).size > 1).map((group) => ({ conflict_id: randomUUID(), items: group.map((item) => item.memory_id), sources: group.map((item) => item.source), timestamps: group.map((item) => item.updated_at), authority: group.map((item) => item.authority), resolution_state: "OPEN", resolution_method: null, human_review_required: true }));
}

export function searchMemory(items: MemoryObject[], filter: { subject?: string; type?: MemoryType; authority?: MemoryObject["authority"]; provenance?: ProvenanceType; status?: MemoryStatus; scope?: string; since?: string; until?: string }): MemoryObject[] {
  return items.filter((item) => item.revocation.status !== "REVOKED" && (!filter.subject || item.subject === filter.subject) && (!filter.type || item.type === filter.type) && (!filter.authority || item.authority === filter.authority) && (!filter.provenance || item.provenance.type === filter.provenance) && (!filter.status || item.revocation.status === filter.status) && (!filter.scope || item.scope === filter.scope) && (!filter.since || item.updated_at >= filter.since) && (!filter.until || item.updated_at <= filter.until));
}

export function assembleMinimumContext(input: { intent: string; memories: MemoryObject[]; policy?: string[]; tools?: string[]; unavailable?: string[]; maxItems?: number }): ContextAssembly {
  const active = input.memories.filter((memory) => memory.revocation.status === "ACTIVE" && (!memory.expiration || new Date(memory.expiration) > new Date()));
  const conflicts = detectMemoryConflicts(active);
  const conflictIds = new Set(conflicts.flatMap((conflict) => conflict.items));
  const scored = active.map((memory) => ({ memory, score: (memory.subject && input.intent.toLowerCase().includes(memory.subject.toLowerCase()) ? 3 : 0) + (memory.type === "USER_AUTHORIZED_PREFERENCE" ? 2 : 0) + (memory.information_state === "KNOWN" ? 1 : 0) })).sort((a, b) => b.score - a.score);
  const included = scored.filter(({ memory }) => !conflictIds.has(memory.memory_id)).slice(0, input.maxItems ?? 12).map(({ memory }) => memory);
  const selected = new Set(included.map((memory) => memory.memory_id));
  const evidence = included.filter((memory) => memory.type === "EVIDENCE" || memory.type === "PROVENANCE");
  const systemState = included.filter((memory) => memory.type === "SYSTEM_STATE" || memory.type === "ADAPTIVE_CONFIGURATION");
  const irrelevant = active.filter((memory) => !selected.has(memory.memory_id) && !conflictIds.has(memory.memory_id));
  const unavailable = [...(input.unavailable ?? []), ...conflicts.map((conflict) => `conflict ${conflict.conflict_id} requires human review`)];
  return { intent: input.intent, included, evidence, systemState, policy: input.policy ?? [], tools: input.tools ?? [], irrelevant, unavailable, suppliedMemoryIds: included.map((memory) => memory.memory_id), contextText: included.map((memory) => `[${memory.type}|${memory.provenance.type}|${memory.information_state}] ${memory.subject ?? "context"}: ${memory.content}`).join("\n"), receiptIds: included.flatMap((memory) => memory.related_receipts) };
}

export function contextAccounting(assembly: ContextAssembly, receipt?: IntelligenceReceipt): { memoryIds: string[]; receiptIds: string[]; accounted: boolean } {
  return { memoryIds: assembly.suppliedMemoryIds, receiptIds: [...assembly.receiptIds, ...(receipt ? [receipt.receipt_id] : [])], accounted: true };
}
