import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalModelRegistry, OpenAiCompatibleLocalProvider } from "./local-model";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Stage 3 local model provider", () => {
  it("discovers a configured model and reports health", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "keira-test" }] }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const provider = new OpenAiCompatibleLocalProvider("http://127.0.0.1:11434/v1", "keira-test", "ollama");
    const info = await provider.modelInfo();
    expect(info.provider).toBe("ollama");
    expect(info.status).toBe("HEALTHY");
    expect(info.health.runtimeReachable).toBe(true);
    expect(info.health.modelLoaded).toBe(true);
  });

  it("executes local inference as generated content, not verified truth", async () => {
    globalThis.fetch = vi.fn(async (input) => {
      expect(String(input)).toContain("/chat/completions");
      return new Response(JSON.stringify({ choices: [{ message: { content: "generated local answer" }, finish_reason: "stop" }], usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 } }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const provider = new OpenAiCompatibleLocalProvider("http://127.0.0.1:8080/v1", "test-model", "vllm");
    const result = await provider.generate({ system: "system", messages: [{ role: "user", content: "hello" }], contextBoundary: "LOCAL_ONLY" });
    expect(result.local).toBe(true);
    expect(result.resultState).toBe("GENERATED_INFERENCE");
    expect(result.dataLeftLocalNode).toBe(false);
    expect(result.usage?.totalTokens).toBe(7);
    expect(result.provider).toBe("vllm");
  });

  it("fails closed for missing configuration and prohibited external processing", async () => {
    const unconfigured = new OpenAiCompatibleLocalProvider("", "", "ollama");
    await expect(unconfigured.generate({ system: "", messages: [] })).rejects.toThrow("LOCAL_MODEL_UNAVAILABLE");
    const configured = new OpenAiCompatibleLocalProvider("http://127.0.0.1:11434/v1", "model", "ollama");
    await expect(configured.generate({ system: "private", messages: [], contextBoundary: "PROHIBITED_FOR_EXTERNAL_PROCESSING" })).rejects.toThrow("External processing boundary");
  });

  it("rejects malformed model responses", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] }), { status: 200 })) as typeof fetch;
    const provider = new OpenAiCompatibleLocalProvider("http://127.0.0.1:11434/v1", "model", "ollama");
    await expect(provider.generate({ system: "", messages: [] })).rejects.toThrow("malformed");
  });

  it("supports caller cancellation and estimates usage", async () => {
    globalThis.fetch = vi.fn((_input, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })) as typeof fetch;
    const provider = new OpenAiCompatibleLocalProvider("http://127.0.0.1:11434/v1", "model", "ollama");
    const controller = new AbortController();
    const pending = provider.generate({ system: "system", messages: [{ role: "user", content: "hello" }], signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow("timed out or was cancelled");
    expect(provider.estimateUsage({ system: "1234", messages: [] }).inputTokens).toBe(1);
    expect(provider.cancel("missing-request")).toBe(false);
  });

  it("stores registry entries without assuming configured models exist", () => {
    const registry = new LocalModelRegistry();
    registry.register({ model_id: "ollama:model", provider: "ollama", endpoint: "http://127.0.0.1:11434/v1", model_name: "model", context_window: null, capabilities: ["generate"], quantization: null, status: "CONFIGURED_NOT_VERIFIED", local_only: true, enabled: true, health: { runtimeReachable: false, modelLoaded: false, modelResponding: false, contextCapacity: null, generationAvailable: false, failureReason: null, latencyMs: null, checkedAt: new Date().toISOString() }, last_checked: null });
    expect(registry.get("ollama:model")?.status).toBe("CONFIGURED_NOT_VERIFIED");
  });
});
