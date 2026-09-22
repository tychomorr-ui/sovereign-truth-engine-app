import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";
import type { LocalChatMessage } from "./local-gateway";

export type ModelEndpointClass = "LOCAL_LOOPBACK" | "LOCAL_NETWORK" | "MESH_AUTHORIZED" | "EXTERNAL";
export type ContextBoundary = "LOCAL_ONLY" | "MESH_AUTHORIZED" | "EXTERNAL_AUTHORIZED" | "PROHIBITED_FOR_EXTERNAL_PROCESSING";
export type ModelCapability = "generate" | "stream" | "health" | "model_info" | "cancel" | "estimate_usage";
export type ModelStatus = "CONFIGURED_NOT_VERIFIED" | "HEALTHY" | "UNAVAILABLE" | "DISABLED" | "ERROR";

export type ModelRegistryEntry = {
  model_id: string;
  provider: "ollama" | "llama.cpp" | "vllm" | "openai-compatible-local";
  endpoint: string;
  model_name: string;
  context_window: number | null;
  capabilities: ModelCapability[];
  quantization: string | null;
  status: ModelStatus;
  local_only: boolean;
  enabled: boolean;
  health: ModelHealth;
  last_checked: string | null;
};

export type ModelHealth = {
  runtimeReachable: boolean;
  modelLoaded: boolean;
  modelResponding: boolean;
  contextCapacity: number | null;
  generationAvailable: boolean;
  failureReason: string | null;
  latencyMs: number | null;
  checkedAt: string;
};

export type ModelRequest = {
  system: string;
  messages: LocalChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  contextBoundary?: ContextBoundary;
  signal?: AbortSignal;
};

export type ModelResult = {
  requestId: string;
  content: string;
  modelId: string;
  provider: string;
  endpointClass: ModelEndpointClass;
  local: boolean;
  dataLeftLocalNode: boolean;
  resultState: "GENERATED_INFERENCE";
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  stopReason?: string;
};

export interface LocalModelProvider {
  generate(request: ModelRequest): Promise<ModelResult>;
  stream(request: ModelRequest): AsyncIterable<string>;
  health(signal?: AbortSignal): Promise<ModelHealth>;
  modelInfo(signal?: AbortSignal): Promise<ModelRegistryEntry>;
  capabilities(): readonly ModelCapability[];
  cancel(requestId: string): boolean;
  estimateUsage(request: ModelRequest): { inputTokens: number; maxOutputTokens: number };
}

function endpointClass(endpoint: string): ModelEndpointClass {
  try {
    const url = new URL(endpoint);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1") return "LOCAL_LOOPBACK";
    if (url.protocol === "https:" && !url.hostname.endsWith(".local")) return "LOCAL_NETWORK";
    return "LOCAL_NETWORK";
  } catch {
    return "LOCAL_NETWORK";
  }
}

function providerName(runtime: string): ModelRegistryEntry["provider"] {
  const normalized = runtime.toLowerCase();
  if (normalized.includes("ollama")) return "ollama";
  if (normalized.includes("llama")) return "llama.cpp";
  if (normalized.includes("vllm")) return "vllm";
  return "openai-compatible-local";
}

export class OpenAiCompatibleLocalProvider implements LocalModelProvider {
  private readonly active = new Map<string, AbortController>();
  private readonly endpoint: string;
  private readonly model: string;
  private readonly runtime: string;

  constructor(endpoint = ENV.localLlmBaseUrl, model = ENV.localLlmModel, runtime = ENV.localLlmRuntime || "openai-compatible") {
    this.endpoint = endpoint.replace(/\/$/, "");
    this.model = model;
    this.runtime = runtime;
  }

  capabilities(): readonly ModelCapability[] { return ["generate", "stream", "health", "model_info", "cancel", "estimate_usage"]; }

  estimateUsage(request: ModelRequest) {
    const inputTokens = Math.max(1, Math.ceil(`${request.system}\n${request.messages.map((message) => message.content).join("\n")}`.trim().length / 4));
    return { inputTokens, maxOutputTokens: request.maxTokens ?? ENV.localLlmMaxTokens };
  }

  cancel(requestId: string): boolean {
    const controller = this.active.get(requestId);
    if (!controller) return false;
    controller.abort();
    this.active.delete(requestId);
    return true;
  }

  async generate(request: ModelRequest): Promise<ModelResult> {
    if (request.contextBoundary === "PROHIBITED_FOR_EXTERNAL_PROCESSING" || request.contextBoundary === "EXTERNAL_AUTHORIZED") {
      throw new Error("External processing boundary is not accepted by the local provider.");
    }
    if (!this.endpoint || !this.model) throw new Error("LOCAL_MODEL_UNAVAILABLE: local model is not configured.");
    const requestId = randomUUID();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ENV.localLlmTimeoutMs);
    const started = Date.now();
    this.active.set(requestId, controller);
    if (request.signal) request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(ENV.localLlmApiKey ? { Authorization: `Bearer ${ENV.localLlmApiKey}` } : {}) },
        body: JSON.stringify({ model: this.model, messages: [{ role: "system", content: request.system }, ...request.messages], max_tokens: request.maxTokens ?? ENV.localLlmMaxTokens, temperature: request.temperature ?? ENV.localLlmTemperature, top_p: request.topP ?? ENV.localLlmTopP }),
      });
      if (!response.ok) throw new Error(`LOCAL_MODEL_UNAVAILABLE: runtime returned HTTP ${response.status}.`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("LOCAL_MODEL_UNAVAILABLE: malformed or empty model response.");
      return { requestId, content: content.trim(), modelId: this.model, provider: providerName(this.runtime), endpointClass: endpointClass(this.endpoint), local: true, dataLeftLocalNode: false, resultState: "GENERATED_INFERENCE", latencyMs: Date.now() - started, stopReason: payload.choices?.[0]?.finish_reason, usage: payload.usage ? { inputTokens: payload.usage.prompt_tokens, outputTokens: payload.usage.completion_tokens, totalTokens: payload.usage.total_tokens } : undefined };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw new Error("LOCAL_MODEL_UNAVAILABLE: local model request timed out or was cancelled.");
      throw error;
    } finally {
      clearTimeout(timeout);
      this.active.delete(requestId);
    }
  }

  async *stream(request: ModelRequest): AsyncIterable<string> {
    const result = await this.generate(request);
    yield result.content;
  }

  async health(signal?: AbortSignal): Promise<ModelHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.endpoint || !this.model) return { runtimeReachable: false, modelLoaded: false, modelResponding: false, contextCapacity: null, generationAvailable: false, failureReason: "LOCAL_MODEL_UNAVAILABLE: model or endpoint not configured", latencyMs: null, checkedAt };
    const started = Date.now();
    try {
      const response = await fetch(`${this.endpoint}/models`, { signal });
      if (!response.ok) return { runtimeReachable: true, modelLoaded: false, modelResponding: false, contextCapacity: null, generationAvailable: false, failureReason: `runtime returned HTTP ${response.status}`, latencyMs: Date.now() - started, checkedAt };
      const payload = await response.json() as { data?: Array<{ id?: string }> };
      const modelLoaded = (payload.data ?? []).length === 0 || (payload.data ?? []).some((item) => item.id === this.model);
      return { runtimeReachable: true, modelLoaded, modelResponding: false, contextCapacity: null, generationAvailable: modelLoaded, failureReason: modelLoaded ? null : `model ${this.model} was not listed by runtime`, latencyMs: Date.now() - started, checkedAt };
    } catch (error) {
      return { runtimeReachable: false, modelLoaded: false, modelResponding: false, contextCapacity: null, generationAvailable: false, failureReason: error instanceof Error ? error.message : "runtime health check failed", latencyMs: Date.now() - started, checkedAt };
    }
  }

  async modelInfo(signal?: AbortSignal): Promise<ModelRegistryEntry> {
    const health = await this.health(signal);
    return { model_id: `${providerName(this.runtime)}:${this.model}`, provider: providerName(this.runtime), endpoint: this.endpoint, model_name: this.model, context_window: health.contextCapacity, capabilities: [...this.capabilities()], quantization: null, status: health.generationAvailable ? "HEALTHY" : this.endpoint && this.model ? "UNAVAILABLE" : "CONFIGURED_NOT_VERIFIED", local_only: true, enabled: Boolean(this.endpoint && this.model), health, last_checked: health.checkedAt };
  }
}

export class LocalModelRegistry {
  private readonly entries = new Map<string, ModelRegistryEntry>();
  register(entry: ModelRegistryEntry) { this.entries.set(entry.model_id, entry); return entry; }
  list() { return Array.from(this.entries.values()); }
  get(modelId: string) { return this.entries.get(modelId); }
}

export function getConfiguredLocalModelProvider(): OpenAiCompatibleLocalProvider {
  return new OpenAiCompatibleLocalProvider();
}
