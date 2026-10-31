import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoomerangSwarmResult } from "../client/src/lib/boomerang/types";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  runBoomerangSwarm: vi.fn(),
  persistBoomerangTrajectory: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./boomerang-persistence", () => ({ persistBoomerangTrajectory: mocks.persistBoomerangTrajectory }));
vi.mock("../client/src/lib/boomerang/swarm", () => ({
  runBoomerangSwarm: mocks.runBoomerangSwarm,
  computeBoomerangMerkleRoot: vi.fn(),
}));

import { executeBoomerangForUser } from "./boomerang-telemetry";

const resultFixture: BoomerangSwarmResult = {
  schemaVersion: "2.0.0-phase10",
  queryHash: "query-hash",
  agents: [],
  verifiedEnvelopes: [],
  rejectedEnvelopes: [],
  globalFusion: [],
  merkleRoot: "a".repeat(64),
  agentSignatureScheme: "SHA-256-INTEGRITY-ONLY",
  serverAttestation: "PENDING_SERVER_ED25519",
};

function configureDb() {
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.getDb.mockResolvedValue({
    select: () => ({
      from: () => ({
        where: async () => [{
          userId: 7,
          documentId: "doc-1",
          artifactCid: "cid-1",
          filename: "corpus.md",
          content: "stored corpus evidence",
          vectorJson: JSON.stringify([1, 0, 0]),
        }],
      }),
    }),
    insert: () => ({ values: mocks.insertValues }),
  });
}

describe("Boomerang execution identity contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureDb();
    mocks.runBoomerangSwarm.mockResolvedValue(resultFixture);
    mocks.persistBoomerangTrajectory.mockResolvedValue({ ...resultFixture, trajectoryId: "trajectory-1", userId: 7, createdAt: new Date() });
  });

  it("keeps executionId distinct from trajectoryId and preserves both in telemetry", async () => {
    const execution = await executeBoomerangForUser(7, "verify corpus");
    const telemetry = mocks.insertValues.mock.calls[0][0];
    expect(execution.executionId).not.toBe(execution.trajectoryId);
    expect(telemetry.executionId).toBe(execution.executionId);
    expect(telemetry.trajectoryId).toBe(execution.trajectoryId);
    expect(telemetry.userId).toBe(7);
    expect(execution.corpusId).toHaveLength(64);
  });

  it("creates a distinct execution ID for repeated queries while retaining deterministic corpus identity", async () => {
    const first = await executeBoomerangForUser(7, "verify corpus");
    const second = await executeBoomerangForUser(7, "verify corpus");
    expect(first.executionId).not.toBe(second.executionId);
    expect(first.corpusId).toBe(second.corpusId);
  });

  it("retains the generated execution ID in failed telemetry before rethrowing", async () => {
    mocks.runBoomerangSwarm.mockRejectedValueOnce(new Error("swarm unavailable"));
    await expect(executeBoomerangForUser(7, "verify corpus")).rejects.toThrow("swarm unavailable");
    const telemetry = mocks.insertValues.mock.calls[0][0];
    expect(telemetry.executionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(telemetry.trajectoryId).toBeUndefined();
    expect(telemetry.status).toBe("FAILED");
    expect(telemetry.userId).toBe(7);
  });
});
