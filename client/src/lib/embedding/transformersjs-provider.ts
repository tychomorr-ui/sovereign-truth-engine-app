import {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_LOCAL_MODEL_ASSETS,
  DEFAULT_LOCAL_MODEL_REVISION,
  DEFAULT_LOCAL_WASM_ASSETS,
  TRANSFORMERS_BROWSER_CACHE,
  type EmbeddingCacheStatus,
  type EmbeddingPipeline,
  type EmbeddingPipelineFactory,
  type EmbeddingProvider,
  type EmbeddingProviderMetadata,
  type EmbeddingRuntime,
  type LocalModelAssetMap,
} from "./types";

const MODEL_VERSION = `onnx-feature-extraction-384@${DEFAULT_LOCAL_MODEL_REVISION}`;

async function observeCache(): Promise<{ status: EmbeddingCacheStatus; entries: number | null }> {
  if (typeof globalThis.caches === "undefined") return { status: "CACHE_UNAVAILABLE", entries: null };
  try {
    const cache = await globalThis.caches.open(TRANSFORMERS_BROWSER_CACHE);
    const entries = (await cache.keys()).length;
    return { status: entries > 0 ? "CACHE_PRESENT" : "CACHE_EMPTY", entries };
  } catch {
    return { status: "CACHE_UNAVAILABLE", entries: null };
  }
}

function createSameOriginAssetFetch(assetMap: LocalModelAssetMap): typeof fetch {
  return async (input, init) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(requestUrl, globalThis.location?.origin ?? "http://localhost").pathname;
    const asset = Object.keys(assetMap).find((candidate) => pathname.endsWith(`/${candidate}`) || pathname === `/${candidate}`);
    if (!asset) throw new Error(`Local embedding asset is not allow-listed: ${pathname}`);
    return fetch(assetMap[asset], init);
  };
}

async function defaultPipelineFactory(
  model: string,
  runtime: EmbeddingRuntime,
  assetMap: LocalModelAssetMap,
  wasmAssets: { mjs: string; wasm: string },
): Promise<EmbeddingPipeline> {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = "/keira-local-models/";
  env.useBrowserCache = true;
  env.useWasmCache = true;
  env.cacheKey = TRANSFORMERS_BROWSER_CACHE;
  env.fetch = createSameOriginAssetFetch(assetMap);
  if (!env.backends.onnx.wasm) throw new Error("ONNX WASM backend is unavailable.");
  env.backends.onnx.wasm.wasmPaths = wasmAssets;

  const extractor = await pipeline("feature-extraction", model, {
    device: runtime,
    dtype: "q8",
  });
  return extractor as unknown as EmbeddingPipeline;
}

function copyMetadata(metadata: EmbeddingProviderMetadata): EmbeddingProviderMetadata {
  return { ...metadata };
}

/**
 * Provider-neutral browser-local embedding adapter.
 *
 * Model files may be downloaded into the browser's Cache API on first use. No
 * hosted embedding inference endpoint is called: inference executes in the
 * browser through Transformers.js/ONNX Runtime Web.
 */
export class TransformersJsEmbeddingProvider implements EmbeddingProvider {
  private pipeline: EmbeddingPipeline | null = null;
  private initializationPromise: Promise<EmbeddingProviderMetadata> | null = null;
  private state: EmbeddingProviderMetadata;

  constructor(options: {
    model?: string;
    runtime?: EmbeddingRuntime;
    assetMap?: LocalModelAssetMap;
    wasmAssets?: { mjs: string; wasm: string };
    pipelineFactory?: EmbeddingPipelineFactory;
  } = {}) {
    const model = options.model ?? DEFAULT_EMBEDDING_MODEL;
    const runtime = options.runtime ?? "wasm";
    const assetMap = options.assetMap ?? DEFAULT_LOCAL_MODEL_ASSETS;
    const wasmAssets = options.wasmAssets ?? DEFAULT_LOCAL_WASM_ASSETS;
    this.state = {
      model,
      modelVersion: MODEL_VERSION,
      dimension: DEFAULT_EMBEDDING_DIMENSION,
      runtime,
      status: "MODEL_NOT_INITIALIZED",
      initializationCount: 0,
      cacheStatus: "CACHE_UNAVAILABLE",
      cacheEntriesBeforeLoad: null,
      cacheEntriesAfterLoad: null,
      lastError: null,
    };
    this.factory = options.pipelineFactory ?? (() => defaultPipelineFactory(model, runtime, assetMap, wasmAssets));
  }

  private readonly factory: EmbeddingPipelineFactory;

  metadata(): EmbeddingProviderMetadata {
    return copyMetadata(this.state);
  }

  async initialize(): Promise<EmbeddingProviderMetadata> {
    if (this.state.status === "MODEL_READY") return this.metadata();
    if (this.initializationPromise) return this.initializationPromise;

    this.state.status = "MODEL_LOADING";
    this.state.lastError = null;
    this.state.initializationCount += 1;
    this.initializationPromise = (async () => {
      const before = await observeCache();
      this.state.cacheEntriesBeforeLoad = before.entries;
      this.state.cacheStatus = before.status;
      try {
        this.pipeline = await this.factory();
        const after = await observeCache();
        this.state.cacheEntriesAfterLoad = after.entries;
        this.state.cacheStatus = after.entries !== null && after.entries > 0
          ? (before.entries !== null && after.entries > before.entries ? "CACHE_OBSERVED_AFTER_LOAD" : "CACHE_PRESENT")
          : after.status;
        this.state.status = "MODEL_LOADING";
        return this.metadata();
      } catch (error) {
        this.state.status = "MODEL_ERROR";
        this.state.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async embed(text: string): Promise<number[]> {
    const normalized = text.trim();
    if (!normalized) throw new Error("Embedding input cannot be empty.");
    if (!this.pipeline) await this.initialize();
    if (!this.pipeline) throw new Error("Embedding model is not initialized.");

    try {
      const output = await this.pipeline(normalized, { pooling: "mean", normalize: true });
      const vector = this.toVector(output);
      if (vector.length !== this.state.dimension) {
        throw new Error(`Embedding dimension mismatch: expected ${this.state.dimension}, received ${vector.length}.`);
      }
      if (!vector.every(Number.isFinite)) throw new Error("Embedding vector contains a non-finite value.");
      this.state.status = "MODEL_READY";
      this.state.lastError = null;
      return vector;
    } catch (error) {
      this.state.status = "MODEL_ERROR";
      this.state.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private toVector(output: { dims?: number[]; data?: ArrayLike<number>; tolist?: () => unknown }): number[] {
    const listed = output.tolist?.();
    const candidate = Array.isArray(listed) && Array.isArray(listed[0]) ? listed[0] : listed;
    if (Array.isArray(candidate)) return candidate.map(Number);
    if (output.data) return Array.from(output.data, Number);
    throw new Error("Embedding runtime returned no vector data.");
  }
}
