export const DEFAULT_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2" as const;
export const DEFAULT_EMBEDDING_DIMENSION = 384 as const;
export const TRANSFORMERS_BROWSER_CACHE = "transformers-cache" as const;

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
