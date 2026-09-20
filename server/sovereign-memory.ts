import { randomUUID } from "node:crypto";
import { createReceipt, type IntelligenceReceipt } from "./sovereign-bus";

export type MemoryClass = "SHORT_TERM_CONTEXT" | "SESSION_MEMORY" | "LONG_TERM_MEMORY" | "USER_AUTHORIZED_MEMORY" | "SYSTEM_STATE" | "EVIDENCE_MEMORY";
export type MemoryAuthority = "operator" | "system" | "derived";
export type MemorySensitivity = "public" | "private" | "restricted";
export type RetentionPolicy = "turn" | "session" | "until_revoked" | "system";

export type SovereignMemoryRecord = {
  id: string;
  class: MemoryClass;
  content: string;
  source: string;
  timestamp: string;
  authority: MemoryAuthority;
  sensitivity: MemorySensitivity;
  retention: RetentionPolicy;
  provenance: string;
  revoked: boolean;
};

export type MemoryOperationResult = {
  record?: SovereignMemoryRecord;
  records?: SovereignMemoryRecord[];
  receipt: IntelligenceReceipt;
};

export class SovereignMemory {
  private readonly records = new Map<string, SovereignMemoryRecord>();

  write(input: Omit<SovereignMemoryRecord, "id" | "timestamp" | "revoked">): MemoryOperationResult {
    const record: SovereignMemoryRecord = { ...input, id: randomUUID(), timestamp: new Date().toISOString(), revoked: false };
    this.records.set(record.id, record);
    return { record, receipt: createReceipt({ operation: "memory.write", intelligence_mode: "deterministic", provider: "sovereign-memory", model: null, context_sources: [record.source], policy: "memory is explicit, locally controlled, and authorized", verification: "record stored in local memory abstraction", result_state: "PROVEN" }) };
  }

  read(memoryClass?: MemoryClass): MemoryOperationResult {
    const records = Array.from(this.records.values()).filter((record) => !record.revoked && (!memoryClass || record.class === memoryClass));
    return { records, receipt: createReceipt({ operation: "memory.read", intelligence_mode: "deterministic", provider: "sovereign-memory", model: null, context_sources: records.map((record) => record.source), policy: "revoked records excluded", verification: `returned ${records.length} active local record(s)`, result_state: "PROVEN" }) };
  }

  revoke(id: string): MemoryOperationResult {
    const record = this.records.get(id);
    if (record) this.records.set(id, { ...record, revoked: true });
    return { receipt: createReceipt({ operation: "memory.revoke", intelligence_mode: "deterministic", provider: "sovereign-memory", model: null, context_sources: record ? [record.source] : [], policy: "operator revocation is authoritative", verification: record ? "record marked revoked" : "record not found; no mutation performed", result_state: record ? "PROVEN" : "PARTIALLY_PROVEN" }) };
  }

  expire(retention: RetentionPolicy): MemoryOperationResult {
    const expired = Array.from(this.records.values()).filter((record) => record.retention === retention && !record.revoked);
    expired.forEach((record) => this.records.set(record.id, { ...record, revoked: true }));
    return { records: expired, receipt: createReceipt({ operation: "memory.expire", intelligence_mode: "deterministic", provider: "sovereign-memory", model: null, context_sources: expired.map((record) => record.source), policy: "retention policy enforced locally", verification: `revoked ${expired.length} record(s) matching retention policy`, result_state: "PROVEN" }) };
  }
}
