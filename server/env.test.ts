import { describe, expect, it } from "vitest";
import { getLocalModelEnvironmentStatus, resolveLocalModelEnvironment } from "./_core/env";

describe("local model environment contract", () => {
  it("reads the canonical KEIRA_LLM_* variables", () => {
    const environment = resolveLocalModelEnvironment({
      KEIRA_LLM_ENDPOINT: "http://keira-endpoint/v1",
      KEIRA_LLM_MODEL: "llama3.2:3b",
      KEIRA_LLM_RUNTIME: "ollama",
      KEIRA_LLM_MAX_TOKENS: "2048",
    });

    expect(environment.baseUrl).toBe("http://keira-endpoint/v1");
    expect(environment.model).toBe("llama3.2:3b");
    expect(environment.runtime).toBe("ollama");
    expect(environment.maxTokens).toBe(2048);
  });

  it("uses deterministic defaults when local model variables are unset", () => {
    const environment = resolveLocalModelEnvironment({});

    expect(environment.baseUrl).toBe("");
    expect(environment.model).toBe("qwen2.5:3b");
    expect(environment.runtime).toBe("ollama");
  });

  it("classifies loaded, defaulted, and missing KEIRA settings without exposing values", () => {
    const status = getLocalModelEnvironmentStatus({
      KEIRA_LLM_ENDPOINT: "http://keira-endpoint/v1",
      KEIRA_LLM_MODEL: "llama3.2:3b",
    });

    expect(status.loaded).toEqual(["KEIRA_LLM_ENDPOINT", "KEIRA_LLM_MODEL"]);
    expect(status.defaults).toContain("KEIRA_LLM_NUM_CTX=2048");
    expect(status.missing).toContain("KEIRA_LLM_FALLBACK_MODEL");
    expect(JSON.stringify(status)).not.toContain("keira-endpoint");
    expect(JSON.stringify(status)).not.toContain("llama3.2:3b");
  });
});
