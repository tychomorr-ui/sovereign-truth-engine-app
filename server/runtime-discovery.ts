import { ENV } from "./_core/env";
import { getSovereignRuntimeStatus, type SovereignRuntimeStatus } from "./sovereign-bus";

export type LocalRuntimeDiscovery = {
  state: "MODEL_READY" | "MODEL_AVAILABLE" | "MODEL_NOT_CONFIGURED" | "MODEL_UNAVAILABLE" | "MODEL_ERROR";
  runtime: string | null;
  models: string[];
  model: string | null;
  format: string | null;
  quantization: string | null;
  contextLength: number | null;
  hardware: { cpu: boolean; gpu: string | null; memoryMb: number | null };
  inferenceReady: boolean;
  checkedAt: string;
  error: string | null;
};

function configuredRuntimeName(): string | null {
  return ENV.localLlmBaseUrl ? ENV.localLlmRuntime || "openai-compatible" : null;
}

export async function discoverLocalRuntime(): Promise<LocalRuntimeDiscovery> {
  const checkedAt = new Date().toISOString();
  if (!ENV.localLlmBaseUrl || !ENV.localLlmModel) {
    return { state: "MODEL_NOT_CONFIGURED", runtime: null, models: [], model: null, format: null, quantization: null, contextLength: null, hardware: { cpu: true, gpu: null, memoryMb: null }, inferenceReady: false, checkedAt, error: null };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(ENV.localLlmTimeoutMs, 2500));
    const response = await fetch(`${ENV.localLlmBaseUrl.replace(/\/$/, "")}/models`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return { state: "MODEL_UNAVAILABLE", runtime: configuredRuntimeName(), models: [], model: ENV.localLlmModel, format: null, quantization: null, contextLength: null, hardware: { cpu: true, gpu: null, memoryMb: null }, inferenceReady: false, checkedAt, error: `Runtime returned HTTP ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const models = (payload.data ?? []).flatMap((model) => typeof model.id === "string" ? [model.id] : []);
    const modelReady = models.length === 0 || models.includes(ENV.localLlmModel);
    return { state: modelReady ? "MODEL_READY" : "MODEL_AVAILABLE", runtime: configuredRuntimeName(), models, model: ENV.localLlmModel, format: null, quantization: null, contextLength: null, hardware: { cpu: true, gpu: null, memoryMb: null }, inferenceReady: modelReady, checkedAt, error: null };
  } catch (error) {
    return { state: "MODEL_ERROR", runtime: configuredRuntimeName(), models: [], model: ENV.localLlmModel, format: null, quantization: null, contextLength: null, hardware: { cpu: true, gpu: null, memoryMb: null }, inferenceReady: false, checkedAt, error: error instanceof Error ? error.message : "Local runtime probe failed." };
  }
}

export async function getRuntimeReport(): Promise<{ status: SovereignRuntimeStatus; discovery: LocalRuntimeDiscovery }> {
  const discovery = await discoverLocalRuntime();
  const network: SovereignRuntimeStatus["network"] = ENV.localLlmBaseUrl ? (discovery.state === "MODEL_ERROR" ? "offline" : "online") : "offline";
  return { status: getSovereignRuntimeStatus(network), discovery };
}
