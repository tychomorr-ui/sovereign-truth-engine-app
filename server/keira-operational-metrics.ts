import { createHash } from "node:crypto";

export type KeiraRoute = "FAST_PATH" | "DETERMINISTIC" | "MIST" | "LLM" | "CACHE" | "ERROR";

type RouteSample = { route: KeiraRoute; latencyMs: number; cacheHit: boolean; error: boolean; confidence: number };

const samples: RouteSample[] = [];
const MAX_SAMPLES = 2_000;

export function recordKeiraRoute(sample: RouteSample): void {
  samples.push({ ...sample, latencyMs: Math.max(0, sample.latencyMs), confidence: Math.max(0, Math.min(1, sample.confidence)) });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length))] ?? 0;
}

export type KeiraOperationalState = {
  componentId: "KEIRA";
  version: "1";
  totalRequests: number;
  fastPathRequests: number;
  deterministicRequests: number;
  mistRequests: number;
  llmRequests: number;
  cacheHits: number;
  errorCount: number;
  fastPathHitRate: number;
  deterministicHitRate: number;
  mistInvocationRate: number;
  llmInvocationRate: number;
  cacheHitRate: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  routingConfidence: number;
  anomalyFlags: string[];
  stateHash: string;
  timestamp: string;
};

export function getKeiraOperationalState(now = new Date()): KeiraOperationalState {
  const totalRequests = samples.length;
  const latencies = samples.map((sample) => sample.latencyMs);
  const count = (route: KeiraRoute) => samples.filter((sample) => sample.route === route).length;
  const errors = samples.filter((sample) => sample.error).length;
  const averageConfidence = totalRequests ? samples.reduce((sum, sample) => sum + sample.confidence, 0) / totalRequests : 0;
  const anomalyFlags: string[] = [];
  if (totalRequests >= 20 && errors / totalRequests > 0.1) anomalyFlags.push("ERROR_RATE_ELEVATED");
  if (totalRequests >= 20 && count("LLM") / totalRequests > 0.8) anomalyFlags.push("LLM_ESCALATION_ELEVATED");

  const stateWithoutHash = {
    componentId: "KEIRA" as const,
    version: "1" as const,
    totalRequests,
    fastPathRequests: count("FAST_PATH"),
    deterministicRequests: count("DETERMINISTIC"),
    mistRequests: count("MIST"),
    llmRequests: count("LLM"),
    cacheHits: samples.filter((sample) => sample.cacheHit).length,
    errorCount: errors,
    fastPathHitRate: totalRequests ? count("FAST_PATH") / totalRequests : 0,
    deterministicHitRate: totalRequests ? (count("FAST_PATH") + count("DETERMINISTIC")) / totalRequests : 0,
    mistInvocationRate: totalRequests ? count("MIST") / totalRequests : 0,
    llmInvocationRate: totalRequests ? count("LLM") / totalRequests : 0,
    cacheHitRate: totalRequests ? samples.filter((sample) => sample.cacheHit).length / totalRequests : 0,
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    latencyP99: percentile(latencies, 99),
    routingConfidence: averageConfidence,
    anomalyFlags,
    timestamp: now.toISOString(),
  };
  const stateHash = createHash("sha256").update(JSON.stringify(stateWithoutHash)).digest("hex");
  return { ...stateWithoutHash, stateHash };
}

export function resetKeiraOperationalMetrics(): void {
  samples.length = 0;
}
