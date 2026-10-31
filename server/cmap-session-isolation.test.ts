import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { initializecMAPSession, processcMAPMessage } from "./cmap-portal-integration";

function configureOperatorFixture() {
  mocks.getDb.mockResolvedValue({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 1, name: "Fixture Operator" }],
        }),
      }),
    }),
  });
}

describe("cMAP Session Isolation", () => {
  it("isolates mission state per conversation ID with an explicit operator fixture", async () => {
    configureOperatorFixture();
    const sessionA = await initializecMAPSession(1);
    const sessionB = await initializecMAPSession(1);

    const updatedA = processcMAPMessage("Mission Alpha: Build sovereign rocket.", sessionA);
    const updatedB = processcMAPMessage("Mission Beta: Audit quantum ledger.", sessionB);

    expect(updatedA.missionState.missionIntent).toBe("Mission Alpha: Build sovereign rocket");
    expect(updatedB.missionState.missionIntent).toBe("Mission Beta: Audit quantum ledger");
    expect(updatedA.missionState.missionIntent).not.toBe(updatedB.missionState.missionIntent);
    expect(sessionA.sessionId).not.toBe(sessionB.sessionId);
  });
});
