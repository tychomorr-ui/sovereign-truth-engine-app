import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { keiraAdaptationRecords } from "../drizzle/schema";
import type { AdaptationProposal } from "./adaptation-engine";

export async function persistAdaptation(userId: number, proposal: AdaptationProposal): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Adaptation persistence is unavailable: database is not configured.");
  await db.insert(keiraAdaptationRecords).values({ adaptationId: proposal.adaptation_id, userId, variable: proposal.variable, currentState: JSON.stringify(proposal.current_state), proposedState: JSON.stringify(proposal.proposed_state), reason: proposal.reason, evidence: JSON.stringify(proposal.evidence), expectedEffect: proposal.expected_effect, risk: proposal.risk, authority: proposal.authority, approval: proposal.approval, mode: proposal.mode, rollbackState: JSON.stringify(proposal.rollback_state), result: proposal.result, receiptId: proposal.receipt_id, createdAt: new Date(proposal.created_at), activatedAt: proposal.activated_at ? new Date(proposal.activated_at) : null, rolledBackAt: proposal.rolled_back_at ? new Date(proposal.rolled_back_at) : null });
}

export async function listAdaptations(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Adaptation persistence is unavailable: database is not configured.");
  return db.select().from(keiraAdaptationRecords).where(eq(keiraAdaptationRecords.userId, userId)).orderBy(desc(keiraAdaptationRecords.createdAt)).limit(Math.max(1, Math.min(500, Math.floor(limit))));
}
