import { randomUUID } from "node:crypto";
import { deterministicResponse, invokeLocal, isLocalModelConfigured, type LocalChatMessage } from "./local-gateway";
import { ENV } from "./_core/env";
import type { ContextBoundary } from "./local-model";

export type IntelligenceMode = "deterministic" | "local_model" | "local_tool" | "trusted_mesh" | "external";
export type CapabilityId = "deterministic" | "local_model" | "local_tool" | "trusted_mesh" | "external_provider";
export type CapabilityState = "READY" | "AVAILABLE" | "NOT_CONFIGURED" | "UNAVAILABLE" | "ERROR" | "DISABLED";

export type IntelligenceReceipt = {
  receipt_id: string;
  timestamp: string;
  operation: string;
  intelligence_mode: IntelligenceMode;
  provider: string | null;
  model: string | null;
  context_sources: string[];
  external_service_used: boolean;
  data_left_local_node: boolean;
  policy: string;
  verification: string;
  result_state: string;
};

export type IntelligenceResult<T> = {
  status: "ok" | "LOCAL_CAPABILITY_UNAVAILABLE" | "error";
  value?: T;
  reason?: string;
  external_fallback: false;
  receipt: IntelligenceReceipt;
};

export type SovereignRuntimeStatus = {
  deterministic: CapabilityState;
  localModel: CapabilityState;
  localModelName: string | null;
  localRuntime: string | null;
  localMemory: CapabilityState;
  localTools: CapabilityState;
  trustedMesh: CapabilityState;
  externalProviders: CapabilityState;
  network: "offline" | "online" | "not_available";
  provenance: CapabilityState;
  offlineMode: CapabilityState;
};

export function createReceipt(input: Omit<IntelligenceReceipt, "receipt_id" | "timestamp" | "external_service_used" | "data_left_local_node"> & Partial<Pick<IntelligenceReceipt, "external_service_used" | "data_left_local_node">>): IntelligenceReceipt {
  return {
    receipt_id: randomUUID(),
    timestamp: new Date().toISOString(),
    external_service_used: input.external_service_used ?? false,
    data_left_local_node: input.data_left_local_node ?? false,
    ...input,
  };
}

export function validateReceipt(receipt: Partial<IntelligenceReceipt>): { valid: boolean; reason: string } {
  const required = ["receipt_id", "timestamp", "operation", "intelligence_mode", "policy", "verification", "result_state"] as const;
  const missing = required.filter((field) => !receipt[field]);
  if (missing.length) return { valid: false, reason: `missing receipt fields: ${missing.join(", ")}` };
  if (!Array.isArray(receipt.context_sources)) return { valid: false, reason: "context_sources must be an array" };
  if (!receipt.receipt_id || !/^[0-9a-f-]{36}$/i.test(receipt.receipt_id)) return { valid: false, reason: "receipt_id is not a UUID" };
  return { valid: true, reason: "receipt contract complete" };
}

export class ReceiptIntegrityLedger {
  private readonly entries = new Map<string, IntelligenceReceipt>();
  append(receipt: IntelligenceReceipt): IntelligenceReceipt {
    const validation = validateReceipt(receipt);
    if (!validation.valid) throw new Error(validation.reason);
    if (this.entries.has(receipt.receipt_id)) throw new Error(`duplicate receipt ID: ${receipt.receipt_id}`);
    this.entries.set(receipt.receipt_id, Object.freeze({ ...receipt }));
    return this.entries.get(receipt.receipt_id)!;
  }
  get(receiptId: string): IntelligenceReceipt | undefined { return this.entries.get(receiptId); }
  list(): IntelligenceReceipt[] { return Array.from(this.entries.values()).map((entry) => ({ ...entry })); }
}

export function resolveCapabilities(): Record<CapabilityId, CapabilityState> {
  return {
    deterministic: "READY",
    local_model: isLocalModelConfigured() ? "READY" : "NOT_CONFIGURED",
    local_tool: "AVAILABLE",
    trusted_mesh: "NOT_CONFIGURED",
    external_provider: "DISABLED",
  };
}

export function getSovereignRuntimeStatus(network: SovereignRuntimeStatus["network"] = "not_available"): SovereignRuntimeStatus {
  const capabilities = resolveCapabilities();
  return {
    deterministic: capabilities.deterministic,
    localModel: capabilities.local_model,
    localModelName: isLocalModelConfigured() ? ENV.localLlmModel : null,
    localRuntime: isLocalModelConfigured() ? ENV.localLlmRuntime || "openai-compatible" : null,
    localMemory: "READY",
    localTools: capabilities.local_tool,
    trustedMesh: capabilities.trusted_mesh,
    externalProviders: capabilities.external_provider,
    network,
    provenance: "READY",
    offlineMode: "AVAILABLE",
  };
}

export function resolvePreferredCapability(requested?: CapabilityId): CapabilityId {
  if (requested && requested !== "external_provider") return requested;
  const capabilities = resolveCapabilities();
  if (capabilities.deterministic === "READY") return "deterministic";
  if (capabilities.local_model === "READY") return "local_model";
  if (capabilities.local_tool === "AVAILABLE") return "local_tool";
  if (capabilities.trusted_mesh === "READY") return "trusted_mesh";
  return "external_provider";
}

export async function routeLocalConversation(input: {
  system: string;
  messages: LocalChatMessage[];
  operation?: string;
  contextSources?: string[];
  requested?: CapabilityId;
  maxTokens?: number;
  temperature?: number;
    topP?: number;
    contextBoundary?: ContextBoundary;
}): Promise<IntelligenceResult<{ content: string; modelId: string; provider: string }>> {
  const operation = input.operation ?? "conversation.generate";
  const contextSources = input.contextSources ?? [];
  const selected = resolvePreferredCapability(input.requested);

  if (selected === "external_provider") {
    return {
      status: "LOCAL_CAPABILITY_UNAVAILABLE",
      reason: "No local capability can satisfy this request.",
      external_fallback: false,
      receipt: createReceipt({ operation, intelligence_mode: "external", provider: null, model: null, context_sources: contextSources, policy: "external providers disabled", verification: "local capability resolver exhausted", result_state: "LOCAL_CAPABILITY_UNAVAILABLE" }),
    };
  }

  if (selected === "deterministic") {
    const response = deterministicResponse(input);
    return {
      status: "ok",
      value: { content: response.content, modelId: response.modelId, provider: response.provider },
      external_fallback: false,
      receipt: createReceipt({ operation, intelligence_mode: "deterministic", provider: "deterministic-engine", model: response.modelId, context_sources: contextSources, policy: "deterministic-first; external providers disabled", verification: "deterministic transform completed; no model inference was attempted", result_state: "PROVEN" }),
    };
  }

  if (selected === "local_model") {
    try {
      const response = await invokeLocal(input);
      return {
        status: "ok",
        value: { content: response.content, modelId: response.modelId, provider: response.provider },
        external_fallback: false,
        receipt: createReceipt({ operation, intelligence_mode: response.provider === "local" ? "local_model" : "deterministic", provider: response.provider, model: response.modelId, context_sources: contextSources, policy: "local model allowed; external providers disabled", verification: response.provider === "local" ? "local model generated inference; KEIRA verification required" : "deterministic fallback completed", result_state: response.provider === "local" ? "GENERATED_INFERENCE" : "PARTIALLY_PROVEN" }),
      };
    } catch (error) {
      const fallback = deterministicResponse(input);
      return {
        status: "ok",
        value: { content: fallback.content, modelId: fallback.modelId, provider: fallback.provider },
        external_fallback: false,
        receipt: createReceipt({ operation, intelligence_mode: "deterministic", provider: "deterministic-engine", model: fallback.modelId, context_sources: contextSources, policy: "local model failure may use deterministic fallback; external providers disabled", verification: `local model failed; deterministic fallback completed (${error instanceof Error ? error.message : "unknown error"})`, result_state: "PARTIALLY_PROVEN" }),
      };
    }
  }

  return {
    status: "LOCAL_CAPABILITY_UNAVAILABLE",
    reason: `Capability ${selected} is reserved or not implemented in this release.`,
    external_fallback: false,
    receipt: createReceipt({ operation, intelligence_mode: selected === "local_tool" ? "local_tool" : "trusted_mesh", provider: null, model: null, context_sources: contextSources, policy: "only implemented local capabilities may execute", verification: "capability reserved or not implemented", result_state: "NOT_IMPLEMENTED" }),
  };
}
