import { describe, expect, it } from "vitest";
import { classifyAndRoute, deterministicResponseForDecision } from "./keira-routing-core";

describe("KEIRA deterministic routing core", () => {
  it("preserves Level-1 fast-path routing", () => {
    const decision = classifyAndRoute("  HeLLo, KEIRA!  ");
    expect(decision).toMatchObject({ intent: "GREETING", execution: "DETERMINISTIC", confidence: 1, requiresRetrieval: false, requiresGeneration: false });
  });

  it("routes status and navigation to deterministic execution", () => {
    expect(classifyAndRoute("show runtime status")).toMatchObject({ intent: "STATUS", execution: "DETERMINISTIC", requiresRetrieval: false });
    expect(classifyAndRoute("open settings")).toMatchObject({ intent: "NAVIGATION", execution: "DETERMINISTIC", requiresRetrieval: false });
    expect(deterministicResponseForDecision(classifyAndRoute("show runtime status"))).toContain("runtime status");
  });

  it("escalates corpus questions to targeted MIST retrieval", () => {
    expect(classifyAndRoute("What does the uploaded policy say about retention?")).toMatchObject({ intent: "RETRIEVAL_REQUIRED", execution: "MIST", requiresContext: true, requiresRetrieval: true, requiresGeneration: true });
  });

  it("escalates commands without pretending to execute them", () => {
    expect(classifyAndRoute("delete the uploaded document")).toMatchObject({ intent: "COMMAND", execution: "LLM", confidence: 0.55, requiresRetrieval: false, requiresGeneration: true });
  });

  it("does not fabricate certainty for ordinary questions", () => {
    expect(classifyAndRoute("Explain the tradeoffs between two indexing strategies")).toMatchObject({ intent: "REASONING_REQUIRED", execution: "LLM", confidence: 0.5, requiresRetrieval: false });
  });
});
