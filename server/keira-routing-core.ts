import { classifyFastPath, type FastPathClass } from "../client/src/lib/keira/fast-path";

export type KeiraIntent =
  | "GREETING"
  | "IDENTITY"
  | "META"
  | "REFUSAL"
  | "COMMAND"
  | "STATUS"
  | "SYSTEM_QUERY"
  | "KNOWN_OPERATION"
  | "KNOWN_FACT"
  | "NAVIGATION"
  | "KNOWN_LOCAL_STATE"
  | "RETRIEVAL_REQUIRED"
  | "REASONING_REQUIRED";

export type RoutingExecution = "DETERMINISTIC" | "MIST" | "LLM";

export type CoreDecision = {
  intent: KeiraIntent;
  execution: RoutingExecution;
  confidence: number;
  requiresContext: boolean;
  requiresRetrieval: boolean;
  requiresGeneration: boolean;
  reason: string;
  receiptMetadata: {
    classifier: "keira-deterministic-core";
    fastPathClass?: FastPathClass;
  };
};

const DETERMINISTIC_RESPONSES: Partial<Record<KeiraIntent, string>> = {
  STATUS: "KEIRA runtime status is available through the Interface panel.",
  SYSTEM_QUERY: "System configuration is available through the authenticated runtime status surface.",
  NAVIGATION: "Use the requested KEIRA surface directly; navigation does not require retrieval or model inference.",
};

const RETRIEVAL_TERMS = [
  "document",
  "corpus",
  "uploaded",
  "evidence",
  "cite",
  "citation",
  "source",
  "according to",
  "what does",
  "where does",
  "when did",
  "who said",
  "in the file",
  "in the policy",
] as const;

const STATUS_TERMS = ["status", "health", "latency", "runtime status", "is ollama", "is llama"] as const;
const SYSTEM_TERMS = ["system configuration", "model configuration", "which model", "what model is configured", "runtime configuration"] as const;
const NAVIGATION_TERMS = ["open settings", "go to settings", "open corpus", "go to corpus", "open echoes", "open patterns", "open arcana", "open interface"] as const;
const COMMAND_TERMS = ["run ", "execute ", "perform ", "start ", "stop ", "reset ", "delete ", "save ", "export ", "verify "] as const;

function includesTerm(query: string, terms: readonly string[]): boolean {
  return terms.some((term) => query.includes(term));
}

function deterministicResponse(intent: KeiraIntent): string | null {
  return DETERMINISTIC_RESPONSES[intent] ?? null;
}

export function classifyAndRoute(query: string): CoreDecision {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  const fastPath = classifyFastPath(normalized);
  if (fastPath.isFastPath && fastPath.classification) {
    return {
      intent: fastPath.classification,
      execution: "DETERMINISTIC",
      confidence: 1,
      requiresContext: false,
      requiresRetrieval: false,
      requiresGeneration: false,
      reason: "Level-1 persona gate resolved the request without retrieval or inference.",
      receiptMetadata: { classifier: "keira-deterministic-core", fastPathClass: fastPath.classification },
    };
  }

  if (!normalized) {
    return {
      intent: "REASONING_REQUIRED",
      execution: "LLM",
      confidence: 0,
      requiresContext: false,
      requiresRetrieval: false,
      requiresGeneration: false,
      reason: "Empty input cannot be safely interpreted.",
      receiptMetadata: { classifier: "keira-deterministic-core" },
    };
  }

  if (includesTerm(normalized, STATUS_TERMS)) {
    return deterministicDecision("STATUS", "Status is a local runtime inspection request.");
  }
  if (includesTerm(normalized, SYSTEM_TERMS)) {
    return deterministicDecision("SYSTEM_QUERY", "System configuration is exposed by an existing local status surface.");
  }
  if (includesTerm(normalized, NAVIGATION_TERMS)) {
    return deterministicDecision("NAVIGATION", "Navigation is a local client action.");
  }
  if (includesTerm(normalized, COMMAND_TERMS)) {
    return {
      intent: "COMMAND",
      execution: "LLM",
      confidence: 0.55,
      requiresContext: true,
      requiresRetrieval: false,
      requiresGeneration: true,
      reason: "The request appears actionable but no safe deterministic executor matched it; escalate without fabricating execution.",
      receiptMetadata: { classifier: "keira-deterministic-core" },
    };
  }
  if (includesTerm(normalized, RETRIEVAL_TERMS)) {
    return {
      intent: "RETRIEVAL_REQUIRED",
      execution: "MIST",
      confidence: 0.95,
      requiresContext: true,
      requiresRetrieval: true,
      requiresGeneration: true,
      reason: "The request contains explicit corpus or evidence language; targeted MIST retrieval is required.",
      receiptMetadata: { classifier: "keira-deterministic-core" },
    };
  }

  return {
    intent: "REASONING_REQUIRED",
    execution: "LLM",
    confidence: 0.5,
    requiresContext: true,
    requiresRetrieval: false,
    requiresGeneration: true,
    reason: "No high-confidence deterministic handler matched; bounded local reasoning is required.",
    receiptMetadata: { classifier: "keira-deterministic-core" },
  };
}

function deterministicDecision(intent: "STATUS" | "SYSTEM_QUERY" | "NAVIGATION", reason: string): CoreDecision {
  return {
    intent,
    execution: "DETERMINISTIC",
    confidence: 0.98,
    requiresContext: false,
    requiresRetrieval: false,
    requiresGeneration: false,
    reason,
    receiptMetadata: { classifier: "keira-deterministic-core" },
  };
}

export function deterministicResponseForDecision(decision: CoreDecision): string | null {
  return deterministicResponse(decision.intent);
}
