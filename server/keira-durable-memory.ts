import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { createReceipt, type IntelligenceReceipt } from "./sovereign-bus";
import { keiraIntelligenceReceipts, keiraMemoryRecords, type InsertKeiraMemoryRecord } from "../drizzle/schema";
import type { MemoryClass, MemoryAuthority, MemorySensitivity, RetentionPolicy, SovereignMemoryRecord } from "./sovereign-memory";

export type DurableMemoryInput = Omit<SovereignMemoryRecord, "id" | "timestamp" | "revoked"> & { userId: number };

function memoryReceipt(operation: string, userId: number, sources: string[], verification: string, state: string): IntelligenceReceipt {
  return createReceipt({ operation: `durable.${operation}`, intelligence_mode: "deterministic", provider: "keira-durable-memory", model: null, context_sources: sources, policy: "user-scoped durable memory; revoked records excluded", verification: `user ${userId}: ${verification}`, result_state: state });
}

export async function persistMemory(input: DurableMemoryInput): Promise<{ record: SovereignMemoryRecord; receipt: IntelligenceReceipt }> {
  const db = await getDb();
  if (!db) throw new Error("Durable memory is unavailable: database is not configured.");
  const id = randomUUID();
  const timestamp = new Date();
  const values: InsertKeiraMemoryRecord = { id, userId: input.userId, memoryClass: input.class, content: input.content, source: input.source, authority: input.authority, sensitivity: input.sensitivity, retention: input.retention, provenance: input.provenance, revoked: 0, createdAt: timestamp };
  await db.insert(keiraMemoryRecords).values(values);
  const record: SovereignMemoryRecord = { id, class: input.class, content: input.content, source: input.source, timestamp: timestamp.toISOString(), authority: input.authority, sensitivity: input.sensitivity, retention: input.retention, provenance: input.provenance, revoked: false };
  return { record, receipt: memoryReceipt("memory.write", input.userId, [input.source], "record durably stored", "PROVEN") };
}

export async function readDurableMemory(userId: number, memoryClass?: MemoryClass): Promise<{ records: SovereignMemoryRecord[]; receipt: IntelligenceReceipt }> {
  const db = await getDb();
  if (!db) throw new Error("Durable memory is unavailable: database is not configured.");
  const conditions = [eq(keiraMemoryRecords.userId, userId), eq(keiraMemoryRecords.revoked, 0)];
  if (memoryClass) conditions.push(eq(keiraMemoryRecords.memoryClass, memoryClass));
  const rows = await db.select().from(keiraMemoryRecords).where(and(...conditions)).orderBy(desc(keiraMemoryRecords.createdAt));
  const records = rows.map((row) => ({ id: row.id, class: row.memoryClass as MemoryClass, content: row.content, source: row.source, timestamp: row.createdAt.toISOString(), authority: row.authority as MemoryAuthority, sensitivity: row.sensitivity as MemorySensitivity, retention: row.retention as RetentionPolicy, provenance: row.provenance, revoked: row.revoked === 1 }));
  return { records, receipt: memoryReceipt("memory.read", userId, records.map((record) => record.source), `returned ${records.length} active record(s)`, "PROVEN") };
}

export async function revokeDurableMemory(userId: number, id: string): Promise<{ revoked: boolean; receipt: IntelligenceReceipt }> {
  const db = await getDb();
  if (!db) throw new Error("Durable memory is unavailable: database is not configured.");
  const result = await db.update(keiraMemoryRecords).set({ revoked: 1, revokedAt: new Date() }).where(and(eq(keiraMemoryRecords.id, id), eq(keiraMemoryRecords.userId, userId), eq(keiraMemoryRecords.revoked, 0)));
  const revoked = Number(result[0].affectedRows ?? 0) > 0;
  return { revoked, receipt: memoryReceipt("memory.revoke", userId, [], revoked ? "record revoked" : "record not found or not owned; no mutation performed", revoked ? "PROVEN" : "PARTIALLY_PROVEN") };
}

export async function persistReceipt(userId: number, receipt: IntelligenceReceipt): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Durable receipts are unavailable: database is not configured.");
  await db.insert(keiraIntelligenceReceipts).values({ receiptId: receipt.receipt_id, userId, operation: receipt.operation, intelligenceMode: receipt.intelligence_mode, provider: receipt.provider, model: receipt.model, contextSources: JSON.stringify(receipt.context_sources), externalServiceUsed: receipt.external_service_used ? 1 : 0, dataLeftLocalNode: receipt.data_left_local_node ? 1 : 0, policy: receipt.policy, verification: receipt.verification, resultState: receipt.result_state, createdAt: new Date(receipt.timestamp) });
}

export async function readReceipts(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Durable receipts are unavailable: database is not configured.");
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  return db.select().from(keiraIntelligenceReceipts).where(eq(keiraIntelligenceReceipts.userId, userId)).orderBy(desc(keiraIntelligenceReceipts.createdAt)).limit(boundedLimit);
}
