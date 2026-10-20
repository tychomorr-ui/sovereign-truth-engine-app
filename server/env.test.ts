import { describe, expect, it } from "vitest";
import { getLocalModelEnvironmentStatus, resolveLocalModelEnvironment } from "./_core/env";

describe("local model environment contract", () => {
  it("gives KEIRA_LLM_* variables priority over legacy LOCAL_LLM_* variables", () => {
    const environment = resolveLocalModelEnvironment({
      KEIRA_LLM_ENDPOINT: "http://keira-endpoint/v1",
      LOCAL_LLM_BASE_URL: "http://legacy-endpoint/v1",
      KEIRA_LLM_MODEL: "llama3.2:3b",
      LOCAL_LLM_MODEL: "legacy-model",
      KEIRA_LLM_RUNTIME: "ollama",
      LOCAL_LLM_RUNTIME: "llama.cpp",
      KEIRA_LLM_MAX_TOKENS: "2048",
      LOCAL_LLM_MAX_TOKENS: "4096",
    });

    expect(environment.baseUrl).toBe("http://keira-endpoint/v1");
    expect(environment.model).toBe("llama3.2:3b");
    expect(environment.runtime).toBe("ollama");
    expect(environment.maxTokens).toBe(2048);
  });

  it("uses legacy variables only when canonical KEIRA variables are absent", () => {
    const environment = resolveLocalModelEnvironment({
      LOCAL_LLM_BASE_URL: "http://legacy-endpoint/v1",
      LOCAL_LLM_MODEL: "legacy-model",
      LOCAL_LLM_FALLBACK_MODEL: "legacy-fast-model",
    });

    expect(environment.baseUrl).toBe("http://legacy-endpoint/v1");
    expect(environment.model).toBe("legacy-model");
    expect(environment.fallbackModel).toBe("legacy-fast-model");
  });

  it("classifies loaded, legacy, defaulted, and missing settings without exposing values", () => {
    const status = getLocalModelEnvironmentStatus({
      KEIRA_LLM_ENDPOINT: "http://keira-endpoint/v1",
      LOCAL_LLM_MODEL: "legacy-model",
    });

    expect(status.loaded).toContain("KEIRA_LLM_ENDPOINT");
    expect(status.legacyFallbacks).toContain("LOCAL_LLM_MODEL");
    expect(status.defaults).toContain("KEIRA_LLM_NUM_CTX=2048");
    expect(status.missing).toContain("KEIRA_LLM_FALLBACK_MODEL");
    expect(JSON.stringify(status)).not.toContain("keira-endpoint");
    expect(JSON.stringify(status)).not.toContain("legacy-model");
  });
});
