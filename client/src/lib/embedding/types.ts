export const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2" as const;
export const DEFAULT_EMBEDDING_DIMENSION = 384 as const;
export const TRANSFORMERS_BROWSER_CACHE = "transformers-cache" as const;
export const DEFAULT_LOCAL_MODEL_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9" as const;

export const DEFAULT_LOCAL_MODEL_ASSETS = {
  "config.json": "/manus-storage/config_30f06ef9.json",
  "tokenizer.json": "/manus-storage/tokenizer_7a6eccad.json",
  "tokenizer_config.json": "/manus-storage/tokenizer_config_8fd8bf88.json",
  "special_tokens_map.json": "/manus-storage/special_tokens_map_258fe54e.json",
  "vocab.txt": "/manus-storage/vocab_82956a99.txt",
  "onnx/model_quantized.onnx": "/manus-storage/model_quantized_24f3cce9.onnx",
} as const;

export const DEFAULT_LOCAL_WASM_ASSETS = {
  mjs: "/manus-storage/ort-wasm-simd-threaded.asyncify_bc27fa5b.mjs",
  wasm: "/manus-storage/ort-wasm-simd-threaded.asyncify_e2a710ad.wasm",
} as const;

export type LocalModelAssetMap = Record<string, string>;

export type EmbeddingProviderStatus =
  | "MODEL_NOT_INITIALIZED"
  | "MODEL_LOADING"
  | "MODEL_READY"
  | "MODEL_ERROR";

export type EmbeddingCacheStatus = "CACHE_UNAVAILABLE" | "CACHE_EMPTY" | "CACHE_PRESENT" | "CACHE_OBSERVED_AFTER_LOAD";

export type EmbeddingRuntime = "wasm" | "webgpu";

export type EmbeddingProviderMetadata = {
  model: string;
  modelVersion: string;
  dimension: number;
  runtime: EmbeddingRuntime;
  status: EmbeddingProviderStatus;
  initializationCount: number;
  cacheStatus: EmbeddingCacheStatus;
  cacheEntriesBeforeLoad: number | null;
  cacheEntriesAfterLoad: number | null;
  lastError: string | null;
};

export type EmbeddingProvider = {
  metadata(): EmbeddingProviderMetadata;
  initialize(): Promise<EmbeddingProviderMetadata>;
  embed(text: string): Promise<number[]>;
};

export type EmbeddingPipelineOutput = {
  dims?: number[];
  data?: ArrayLike<number>;
  tolist?: () => unknown;
};

export type EmbeddingPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: true },
) => Promise<EmbeddingPipelineOutput>;

export type EmbeddingPipelineFactory = () => Promise<EmbeddingPipeline>;
