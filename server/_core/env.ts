function configured(env: NodeJS.ProcessEnv, key: string) {
  return env[key]?.trim() ?? "";
}

function numericValue(env: NodeJS.ProcessEnv, key: string, fallback: number) {
  const parsed = Number(configured(env, key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveLocalModelEnvironment(env: NodeJS.ProcessEnv = process.env) {
  return {
    baseUrl: configured(env, "KEIRA_LLM_ENDPOINT"),
    runtime: configured(env, "KEIRA_LLM_RUNTIME") || "ollama",
    model: configured(env, "KEIRA_LLM_MODEL") || "qwen2.5:3b",
    apiKey: configured(env, "KEIRA_LLM_API_KEY"),
    maxTokens: numericValue(env, "KEIRA_LLM_MAX_TOKENS", 4096),
    numCtx: numericValue(env, "KEIRA_LLM_NUM_CTX", 2048),
    fallbackModel: configured(env, "KEIRA_LLM_FALLBACK_MODEL"),
    temperature: numericValue(env, "KEIRA_LLM_TEMPERATURE", 0),
    topP: numericValue(env, "KEIRA_LLM_TOP_P", 1),
    seed: numericValue(env, "KEIRA_LLM_SEED", 42),
    timeoutMs: numericValue(env, "KEIRA_LLM_TIMEOUT_MS", 60000),
  };
}

export type LocalModelEnvironmentStatus = {
  loaded: string[];
  defaults: string[];
  missing: string[];
};

export function getLocalModelEnvironmentStatus(env: NodeJS.ProcessEnv = process.env): LocalModelEnvironmentStatus {
  const definitions = [
    { canonical: "KEIRA_LLM_ENDPOINT", required: true },
    { canonical: "KEIRA_LLM_MODEL", required: true },
    { canonical: "KEIRA_LLM_RUNTIME", required: false, defaultValue: "ollama" },
    { canonical: "KEIRA_LLM_API_KEY", required: false },
    { canonical: "KEIRA_LLM_FALLBACK_MODEL", required: false },
    { canonical: "KEIRA_LLM_MAX_TOKENS", required: false, defaultValue: "4096" },
    { canonical: "KEIRA_LLM_NUM_CTX", required: false, defaultValue: "2048" },
    { canonical: "KEIRA_LLM_TEMPERATURE", required: false, defaultValue: "0" },
    { canonical: "KEIRA_LLM_TOP_P", required: false, defaultValue: "1" },
    { canonical: "KEIRA_LLM_SEED", required: false, defaultValue: "42" },
    { canonical: "KEIRA_LLM_TIMEOUT_MS", required: false, defaultValue: "60000" },
  ];
  const status: LocalModelEnvironmentStatus = { loaded: [], defaults: [], missing: [] };
  for (const definition of definitions) {
    if (env[definition.canonical]?.trim()) status.loaded.push(definition.canonical);
    else if (definition.defaultValue) status.defaults.push(`${definition.canonical}=${definition.defaultValue}`);
    else if (definition.required || definition.canonical === "KEIRA_LLM_FALLBACK_MODEL" || definition.canonical === "KEIRA_LLM_API_KEY") status.missing.push(definition.canonical);
  }
  return status;
}

const localModelEnvironment = resolveLocalModelEnvironment();

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  portalOwnerAccessToken: process.env.PORTAL_OWNER_ACCESS_TOKEN ?? "",
  keiraIdentityRootSecret: process.env.KEIRA_IDENTITY_ROOT_SECRET ?? "",
  betaOpenMode: process.env.BETA_OPEN_MODE === "true",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  awsSessionToken: process.env.AWS_SESSION_TOKEN ?? "",
  // KEIRA_LLM_* is the sole local-model configuration contract.
  localLlmBaseUrl: localModelEnvironment.baseUrl,
  localLlmRuntime: localModelEnvironment.runtime,
  localLlmModel: localModelEnvironment.model,
  localLlmApiKey: localModelEnvironment.apiKey,
  localLlmMaxTokens: localModelEnvironment.maxTokens,
  localLlmNumCtx: localModelEnvironment.numCtx,
  localLlmFallbackModel: localModelEnvironment.fallbackModel,
  localLlmTemperature: localModelEnvironment.temperature,
  localLlmTopP: localModelEnvironment.topP,
  localLlmSeed: localModelEnvironment.seed,
  localLlmTimeoutMs: localModelEnvironment.timeoutMs,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  portalS3Bucket: process.env.PORTAL_S3_BUCKET ?? "",
  portalS3Region: process.env.PORTAL_S3_REGION ?? "",
};
