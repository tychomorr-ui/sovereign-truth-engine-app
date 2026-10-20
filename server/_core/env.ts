function firstConfigured(env: NodeJS.ProcessEnv, ...keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { key, value };
  }
  return { key: null, value: "" };
}

function numericValue(env: NodeJS.ProcessEnv, fallback: number, ...keys: string[]) {
  const configured = firstConfigured(env, ...keys).value;
  const parsed = Number(configured);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveLocalModelEnvironment(env: NodeJS.ProcessEnv = process.env) {
  return {
    baseUrl: firstConfigured(env, "KEIRA_LLM_ENDPOINT", "LOCAL_LLM_BASE_URL").value,
    runtime: firstConfigured(env, "KEIRA_LLM_RUNTIME", "LOCAL_LLM_RUNTIME").value || "ollama",
    model: firstConfigured(env, "KEIRA_LLM_MODEL", "LOCAL_LLM_MODEL").value || "qwen2.5:3b",
    apiKey: firstConfigured(env, "KEIRA_LLM_API_KEY", "LOCAL_LLM_API_KEY").value,
    maxTokens: numericValue(env, 4096, "KEIRA_LLM_MAX_TOKENS", "LOCAL_LLM_MAX_TOKENS"),
    numCtx: numericValue(env, 2048, "KEIRA_LLM_NUM_CTX", "LOCAL_LLM_NUM_CTX"),
    fallbackModel: firstConfigured(env, "KEIRA_LLM_FALLBACK_MODEL", "LOCAL_LLM_FALLBACK_MODEL").value,
    temperature: numericValue(env, 0, "KEIRA_LLM_TEMPERATURE", "LOCAL_LLM_TEMPERATURE"),
    topP: numericValue(env, 1, "KEIRA_LLM_TOP_P", "LOCAL_LLM_TOP_P"),
    seed: numericValue(env, 42, "KEIRA_LLM_SEED", "LOCAL_LLM_SEED"),
    timeoutMs: numericValue(env, 60000, "KEIRA_LLM_TIMEOUT_MS", "LOCAL_LLM_TIMEOUT_MS"),
  };
}

export type LocalModelEnvironmentStatus = {
  loaded: string[];
  legacyFallbacks: string[];
  defaults: string[];
  missing: string[];
};

export function getLocalModelEnvironmentStatus(env: NodeJS.ProcessEnv = process.env): LocalModelEnvironmentStatus {
  const definitions = [
    { canonical: "KEIRA_LLM_ENDPOINT", legacy: "LOCAL_LLM_BASE_URL", required: true },
    { canonical: "KEIRA_LLM_MODEL", legacy: "LOCAL_LLM_MODEL", required: true },
    { canonical: "KEIRA_LLM_RUNTIME", legacy: "LOCAL_LLM_RUNTIME", required: false, defaultValue: "ollama" },
    { canonical: "KEIRA_LLM_API_KEY", legacy: "LOCAL_LLM_API_KEY", required: false },
    { canonical: "KEIRA_LLM_FALLBACK_MODEL", legacy: "LOCAL_LLM_FALLBACK_MODEL", required: false },
    { canonical: "KEIRA_LLM_MAX_TOKENS", legacy: "LOCAL_LLM_MAX_TOKENS", required: false, defaultValue: "4096" },
    { canonical: "KEIRA_LLM_NUM_CTX", legacy: "LOCAL_LLM_NUM_CTX", required: false, defaultValue: "2048" },
    { canonical: "KEIRA_LLM_TEMPERATURE", legacy: "LOCAL_LLM_TEMPERATURE", required: false, defaultValue: "0" },
    { canonical: "KEIRA_LLM_TOP_P", legacy: "LOCAL_LLM_TOP_P", required: false, defaultValue: "1" },
    { canonical: "KEIRA_LLM_SEED", legacy: "LOCAL_LLM_SEED", required: false, defaultValue: "42" },
    { canonical: "KEIRA_LLM_TIMEOUT_MS", legacy: "LOCAL_LLM_TIMEOUT_MS", required: false, defaultValue: "60000" },
  ];
  const status: LocalModelEnvironmentStatus = { loaded: [], legacyFallbacks: [], defaults: [], missing: [] };
  for (const definition of definitions) {
    if (env[definition.canonical]?.trim()) status.loaded.push(definition.canonical);
    else if (env[definition.legacy]?.trim()) status.legacyFallbacks.push(definition.legacy);
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
  // KEIRA_LLM_* is canonical. LOCAL_LLM_* remains a backwards-compatible fallback.
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
