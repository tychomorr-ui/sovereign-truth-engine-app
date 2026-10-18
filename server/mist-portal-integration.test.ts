import { describe, expect, it } from "vitest";
import { createPortalTrajectoryCorpusInput } from "../client/src/lib/mist/portal-trajectory";


describe("Portal Chat MIST trajectory handoff", () => {
  it("creates a stable local corpus envelope from the active conversation", () => {
    const input = createPortalTrajectoryCorpusInput(42, "The hidden pattern", [
      { role: "user", content: "Find the recurring signal." },
      { role: "portal", content: "The recurring signal is not yet verified." },
    ]);

    expect(input).toMatchObject({
      filename: "portal-conversation-42.txt",
      mimeType: "text/plain",
      title: "The hidden pattern",
      source: "portal-chat",
      role: "dialogue",
      scope: "operator-local",
      tags: ["portal", "conversation", "42"],
    });
    expect(input.content).toBe(
      "Operator: Find the recurring signal.\n\nKEIRA: The recurring signal is not yet verified.",
    );
  });

  it("uses an explicit local fallback title and preserves message order", () => {
    const input = createPortalTrajectoryCorpusInput(7, "  ", [
      { role: "portal", content: "First" },
      { role: "user", content: "Second" },
    ]);

    expect(input.title).toBe("Portal conversation");
    expect(input.content).toBe("KEIRA: First\n\nOperator: Second");
  });
});
