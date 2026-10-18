import { afterEach, describe, expect, it, vi } from "vitest";
import { TransformersJsEmbeddingProvider } from "../client/src/lib/embedding/transformersjs-provider";

const originalCaches = globalThis.caches;

afterEach(() => {
  if (originalCaches) Object.defineProperty(globalThis, "caches", { configurable: true, value: originalCaches });
  else Reflect.deleteProperty(globalThis, "caches");
});

function installObservableCache() {
  let entries = 0;
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      open: vi.fn(async () => ({
        keys: vi.fn(async () => Array.from({ length: entries }, (_, index) => new Request(`https://cache.local/${index}`))),
      })),
    },
  });
  return { addEntry: () => { entries += 1; } };
}

function vector(value = 0.25) {
  return Array.from({ length: 384 }, () => value);
}

describe("Phase 3 local embedding provider contract", () => {
  it("exposes the required lifecycle and reaches READY only after a successful embedding", async () => {
    const cache = installObservableCache();
    let factoryCalls = 0;
    const provider = new TransformersJsEmbeddingProvider({
      pipelineFactory: async () => {
        factoryCalls += 1;
        cache.addEntry();
        return async () => ({ dims: [1, 384], tolist: () => [vector()] });
      },
    });

    expect(provider.metadata()).toMatchObject({ status: "MODEL_NOT_INITIALIZED", dimension: 384, cacheStatus: "CACHE_UNAVAILABLE" });
    const embedding = await provider.embed("local browser text");
    expect(embedding).toHaveLength(384);
    expect(provider.metadata()).toMatchObject({ status: "MODEL_READY", cacheStatus: "CACHE_OBSERVED_AFTER_LOAD", cacheEntriesBeforeLoad: 0, cacheEntriesAfterLoad: 1, initializationCount: 1 });
    expect(factoryCalls).toBe(1);

    await provider.embed("a second text");
    expect(factoryCalls).toBe(1);
  });

  it("does not claim READY after initialization alone and observes a subsequent cached load", async () => {
    const cache = installObservableCache();
    const factory = vi.fn(async () => {
      cache.addEntry();
      return async () => ({ dims: [1, 384], tolist: () => [vector(0.5)] });
    });
    const provider = new TransformersJsEmbeddingProvider({ pipelineFactory: factory });

    const initialized = await provider.initialize();
    expect(initialized.status).toBe("MODEL_LOADING");
    expect(provider.metadata().status).toBe("MODEL_LOADING");
    expect(provider.metadata().cacheEntriesAfterLoad).toBe(1);

    await provider.embed("prove readiness");
    expect(provider.metadata().status).toBe("MODEL_READY");
    expect(factory).toHaveBeenCalledOnce();
  });

  it("rejects empty input, malformed dimensions, and non-finite values explicitly", async () => {
    const malformed = new TransformersJsEmbeddingProvider({
      pipelineFactory: async () => async () => ({ dims: [1, 3], tolist: () => [[1, 2, 3]] }),
    });
    await expect(malformed.embed("text")).rejects.toThrow("Embedding dimension mismatch");
    expect(malformed.metadata().status).toBe("MODEL_ERROR");

    const nonFinite = new TransformersJsEmbeddingProvider({
      pipelineFactory: async () => async () => ({ dims: [1, 384], tolist: () => [Array.from({ length: 383 }, () => 0).concat(Number.NaN)] }),
    });
    await expect(nonFinite.embed("text")).rejects.toThrow("non-finite");
    await expect(nonFinite.embed("   ")).rejects.toThrow("cannot be empty");
  });

  it("enters MODEL_ERROR when local initialization fails and never falls back", async () => {
    const provider = new TransformersJsEmbeddingProvider({
      pipelineFactory: async () => { throw new Error("WASM runtime unavailable"); },
    });
    await expect(provider.embed("local text")).rejects.toThrow("WASM runtime unavailable");
    expect(provider.metadata()).toMatchObject({ status: "MODEL_ERROR", lastError: "WASM runtime unavailable" });
  });
});
