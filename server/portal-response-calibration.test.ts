import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLocalMock } = vi.hoisted(() => ({ invokeLocalMock: vi.fn() }));

vi.mock("./local-gateway", () => ({
  invokeLocal: invokeLocalMock,
}));

import { generateAdaptiveResponse } from "./portal-adaptive-response";

const context = {
  userId: 1,
  mirror: { reflections: [], geometryProfile: { avgUnityScore: 0, avgOpportunityScore: 0, avgResistanceLevel: 0, trend: "stable" }, topPatterns: [], averageResistance: 0 },
  learning: { corePatterns: [], growthAreas: [], resistancePoints: [], breakthroughMoments: [], evolutionTimeline: [], lastAnalyzedAt: null },
  chatHistory: { recentConversations: [], recurringThemes: [], averageConversationLength: 0, totalConversations: 0 },
  metadata: { subscriptionTier: "portal", subscriptionStatus: "active", totalReflections: 0, totalChatMessages: 0, accountAgeInDays: 0, lastActivityAt: new Date() },
  synthesis: { learningStage: "awakening", activePatterns: [], breakthroughReadiness: 0, resistanceLevel: 0, emotionalTrajectory: "stable", primaryFocus: "", secondaryFocus: "" },
  profile: { predictiveSensitivity: 75 },
};

const informativeStrategy = {
  strategy: "informative" as const,
  rationale: "Direct operator request",
  responseGuidelines: [],
  contextInjectionPoints: [],
};

describe("KEIRA response calibration", () => {
  beforeEach(() => {
    invokeLocalMock.mockReset();
    invokeLocalMock.mockResolvedValue({ content: "A calibrated answer.", modelId: "test-model", provider: "local" });
  });

  it("applies the saved response variation to the local request", async () => {
    await generateAdaptiveResponse("Explain this clearly.", context as any, informativeStrategy, [], 37);
    const request = invokeLocalMock.mock.calls[0][0];
    expect(request.temperature).toBe(0.37);
    expect(request.topP).toBeCloseTo(0.874, 8);
  });

  it("uses a bounded default when no saved response variation is present", async () => {
    await generateAdaptiveResponse("Explain this clearly.", context as any, informativeStrategy, []);
    const request = invokeLocalMock.mock.calls[0][0];
    expect(request.temperature).toBe(0.1);
    expect(request.topP).toBeCloseTo(0.82, 8);
  });

  it("applies the saved response objective and quality boundaries to the local system contract", async () => {
    const planContext = { ...context, profile: { predictiveSensitivity: 75, responseObjective: "plan" } };
    const response = await generateAdaptiveResponse("Plan the release.", planContext as any, informativeStrategy, []);
    const request = invokeLocalMock.mock.calls[0][0];
    expect(request.system).toContain("OPERATOR-SELECTED RESPONSE OBJECTIVE: PLAN");
    expect(request.system).toContain("executable sequence");
    expect(request.system).toContain("Never invent citations");
    expect(response.metadata.responseObjective).toBe("plan");
  });
});
