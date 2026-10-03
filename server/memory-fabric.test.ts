import { describe, expect, it } from "vitest";
import { assembleMinimumContext, assertMemoryAuthority, contextAccounting, createMemoryObject, detectMemoryConflicts, expireMemory, revokeMemory, searchMemory, supersedeMemory } from "./memory-fabric";

const base = { type: "DURABLE_MEMORY" as const, content: "Tyler prefers direct answers", subject: "response style", source: "operator", provenance: { type: "USER" as const, description: "operator supplied", related_receipts: ["r1"] }, information_state: "KNOWN" as const, confidence: 100, authority: "operator" as const, visibility: "private" as const, retention: "until_revoked" as const, expiration: null, related_receipts: ["r1"], supersedes: null, superseded_by: null, scope: "operator" };

describe("memory fabric", () => {
  it("creates canonical memory with provenance and explicit lifecycle", () => {
    const memory = createMemoryObject(base);
    expect(memory.memory_id).toBeTruthy();
    expect(memory.revocation.status).toBe("ACTIVE");
    expect(memory.provenance.type).toBe("USER");
    expect(contextAccounting(assembleMinimumContext({ intent: "response style", memories: [memory] })).memoryIds).toContain(memory.memory_id);
  });

  it("rejects implicit authority and false evidence classification", () => {
    expect(() => assertMemoryAuthority({ ...base, type: "USER_AUTHORIZED_PREFERENCE", authority: "derived" })).toThrow("requires operator authority");
    expect(() => assertMemoryAuthority({ ...base, type: "EVIDENCE", information_state: "INFERRED" })).toThrow("cannot be stored as evidence");
    expect(() => assertMemoryAuthority({ ...base, provenance: { ...base.provenance, type: "INFERENCE" }, information_state: "KNOWN" })).toThrow("cannot be classified as known");
  });

  it("supports revoke, expire, and supersede without deleting history", () => {
    const memory = createMemoryObject({ ...base, expiration: "2020-01-01T00:00:00.000Z" });
    expect(expireMemory(memory).revocation.status).toBe("EXPIRED");
    expect(revokeMemory(memory, "operator request").revocation.status).toBe("REVOKED");
    const replacement = createMemoryObject(base);
    expect(supersedeMemory(memory, replacement.memory_id).revocation.status).toBe("SUPERSEDED");
  });

  it("detects conflicts instead of silently selecting a winner", () => {
    const first = createMemoryObject(base);
    const second = createMemoryObject({ ...base, content: "Tyler prefers elaborate answers", source: "conversation" });
    const conflicts = detectMemoryConflicts([first, second]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].human_review_required).toBe(true);
    const assembly = assembleMinimumContext({ intent: "response style", memories: [first, second] });
    expect(assembly.included).toHaveLength(0);
    expect(assembly.unavailable[0]).toContain("requires human review");
  });

  it("filters deterministically before any semantic retrieval", () => {
    const preference = createMemoryObject({ ...base, type: "USER_AUTHORIZED_PREFERENCE", authority: "operator" });
    const system = createMemoryObject({ ...base, type: "SYSTEM_STATE", authority: "system", subject: "runtime" });
    expect(searchMemory([preference, system], { type: "USER_AUTHORIZED_PREFERENCE" })).toEqual([preference]);
    expect(searchMemory([preference, system], { subject: "missing" })).toEqual([]);
  });

  it("minimizes context and reports excluded/unavailable information", () => {
    const relevant = createMemoryObject(base);
    const irrelevant = createMemoryObject({ ...base, subject: "unrelated", content: "unrelated detail" });
    const assembly = assembleMinimumContext({ intent: "response style", memories: [relevant, irrelevant], maxItems: 1, policy: ["no external processing"], tools: [] });
    expect(assembly.included.map((item) => item.memory_id)).toEqual([relevant.memory_id]);
    expect(assembly.irrelevant).toContainEqual(irrelevant);
    expect(assembly.policy).toEqual(["no external processing"]);
  });
});
