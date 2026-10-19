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
  // LOCAL_LLM_* remains the canonical internal name; KEIRA_LLM_* aliases make
  // the production deployment contract explicit without exposing anything to
  // the browser.
  localLlmBaseUrl: process.env.LOCAL_LLM_BASE_URL?.trim() || process.env.KEIRA_LLM_ENDPOINT?.trim() || "",
  localLlmRuntime: process.env.LOCAL_LLM_RUNTIME?.trim() || process.env.KEIRA_LLM_RUNTIME?.trim() || "ollama",
  localLlmModel: process.env.LOCAL_LLM_MODEL?.trim() || process.env.KEIRA_LLM_MODEL?.trim() || "qwen2.5:3b",
  localLlmApiKey: process.env.LOCAL_LLM_API_KEY ?? "",
  localLlmMaxTokens: Number(process.env.LOCAL_LLM_MAX_TOKENS ?? 4096),
  localLlmTemperature: Number(process.env.LOCAL_LLM_TEMPERATURE ?? 0),
  localLlmTopP: Number(process.env.LOCAL_LLM_TOP_P ?? 1),
  localLlmSeed: Number(process.env.LOCAL_LLM_SEED ?? 42),
  localLlmTimeoutMs: Number(process.env.LOCAL_LLM_TIMEOUT_MS ?? 60000),
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  portalS3Bucket: process.env.PORTAL_S3_BUCKET ?? "",
  portalS3Region: process.env.PORTAL_S3_REGION ?? "",
};
