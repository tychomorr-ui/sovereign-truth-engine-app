import { describe, expect, it } from "vitest";
import {
  KEIRA_CAPABILITIES_RESPONSE,
  KEIRA_COMPARISON_RESPONSE,
  KEIRA_SYSTEM_PROMPT,
  hardLockResponse,
  truncateToSentences,
} from "./keira-prompt";

describe("KEIRA persona hard lock", () => {
  it("includes the negative constraints in the model contract", () => {
    expect(KEIRA_SYSTEM_PROMPT).toContain("NEVER claim you were \"trained on a vast amount of text data.\"");
    expect(KEIRA_SYSTEM_PROMPT).toContain("NEVER use bullet points or numbered lists.");
    expect(KEIRA_SYSTEM_PROMPT).toContain("NEVER use marketing jargon");
  });

  it("returns the exact comparison line for a ChatGPT comparison", () => {
    expect(hardLockResponse("How do you compare to ChatGPT?", "I was trained on lots of text and offer robust NLP.")).toBe(KEIRA_COMPARISON_RESPONSE);
  });

  it("returns the exact capability line for capability questions", () => {
    expect(hardLockResponse("What are your capabilities?", "- generic capability one\n- generic capability two")).toBe(KEIRA_CAPABILITIES_RESPONSE);
  });

  it("removes list markers and hard-truncates to four sentences", () => {
    const result = truncateToSentences("- One.\n2. Two. Three! Four? Five. Six.", 4);
    expect(result).toBe("One.\nTwo. Three! Four?");
    expect(result.match(/[.!?]/g)).toHaveLength(4);
    expect(result).not.toMatch(/(^|\n)\s*(?:[-*•]|\d+[.)])\s/);
  });
});
