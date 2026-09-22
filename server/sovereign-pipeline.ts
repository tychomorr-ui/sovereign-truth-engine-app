import { createReceipt, resolvePreferredCapability, type CapabilityId, type IntelligenceReceipt } from "./sovereign-bus";

export type PipelineStage = "INTENT" | "CONTEXT" | "CAPABILITY_DISCOVERY" | "AUTHORIZATION" | "POLICY" | "PLAN" | "EXECUTION" | "REFLECTION" | "VERIFICATION" | "RECEIPT";
export type PipelineFailure = "LOCAL_MODEL_UNAVAILABLE" | "TOOL_UNAVAILABLE" | "AUTHORITY_REQUIRED" | "POLICY_DENIED" | "EVIDENCE_INSUFFICIENT" | "PROVENANCE_UNKNOWN" | "NETWORK_UNAVAILABLE" | "EXTERNAL_PROVIDER_UNAVAILABLE" | "RECURSION_LIMIT" | "REFLECTION_LIMIT" | "RESOURCE_LIMIT" | "CONFLICTING_EVIDENCE" | "HUMAN_CONFIRMATION_REQUIRED";

export type PipelineTrace = { stage: PipelineStage; state: "entered" | "completed" | "blocked"; detail: string; at: string }[];

export type SovereignRequest = {
  operation: string;
  intent: string;
  actor: string;
  contextSources?: string[];
  requestedCapability?: CapabilityId;
  authority?: "operator" | "system" | "delegated" | "none";
  consequential?: boolean;
  policyApproved?: boolean;
  humanConfirmed?: boolean;
};

export type SovereignPipelineResult<T> = {
  status: "COMPLETED" | "BLOCKED" | "FAILED";
  value?: T;
  failure?: PipelineFailure;
  trace: PipelineTrace;
  receipt: IntelligenceReceipt;
};

const now = () => new Date().toISOString();

function traceStage(trace: PipelineTrace, stage: PipelineStage, state: PipelineTrace[number]["state"], detail: string) {
  trace.push({ stage, state, detail, at: now() });
}

export async function runSovereignPipeline<T>(request: SovereignRequest, execute: (capability: CapabilityId) => Promise<T>): Promise<SovereignPipelineResult<T>> {
  const trace: PipelineTrace = [];
  traceStage(trace, "INTENT", "completed", request.intent.trim() ? "intent supplied" : "intent missing");
  if (!request.intent.trim()) return blocked(request, trace, "EVIDENCE_INSUFFICIENT", "An explicit intent is required.");

  traceStage(trace, "CONTEXT", "completed", `${request.contextSources?.length ?? 0} context source(s) declared`);
  traceStage(trace, "CAPABILITY_DISCOVERY", "completed", "capability resolver consulted");
  const capability = resolvePreferredCapability(request.requestedCapability);

  traceStage(trace, "AUTHORIZATION", "completed", `authority=${request.authority ?? "none"}`);
  if (request.consequential && !request.humanConfirmed) return blocked(request, trace, "HUMAN_CONFIRMATION_REQUIRED", "Consequential operations require explicit human confirmation.");
  if ((request.authority ?? "none") === "none") return blocked(request, trace, "AUTHORITY_REQUIRED", "Capability does not imply authority.");

  traceStage(trace, "POLICY", "completed", request.policyApproved === false ? "policy denied" : "policy approved by caller");
  if (request.policyApproved === false) return blocked(request, trace, "POLICY_DENIED", "Policy denied the operation.");

  traceStage(trace, "PLAN", "completed", `selected capability=${capability}`);
  traceStage(trace, "EXECUTION", "entered", "execution delegated to selected capability");
  try {
    const value = await execute(capability);
    traceStage(trace, "EXECUTION", "completed", "execution returned");
    traceStage(trace, "REFLECTION", "completed", "pipeline reflection completed without recursive execution");
    traceStage(trace, "VERIFICATION", "completed", "result returned by delegated capability");
    const receipt = createReceipt({ operation: request.operation, intelligence_mode: capability === "deterministic" ? "deterministic" : capability === "local_model" ? "local_model" : "local_tool", provider: capability, model: null, context_sources: request.contextSources ?? [], policy: "explicit authority and policy gate", verification: "pipeline stages completed", result_state: "COMPLETED" });
    traceStage(trace, "RECEIPT", "completed", receipt.receipt_id);
    return { status: "COMPLETED", value, trace, receipt };
  } catch (error) {
    traceStage(trace, "EXECUTION", "blocked", error instanceof Error ? error.message : "execution failed");
    return blocked(request, trace, "RESOURCE_LIMIT", error instanceof Error ? error.message : "Execution failed.");
  }
}

function blocked<T>(request: SovereignRequest, trace: PipelineTrace, failure: PipelineFailure, detail: string): SovereignPipelineResult<T> {
  const lastStage = trace[trace.length - 1]?.stage ?? "INTENT";
  traceStage(trace, lastStage, "blocked", detail);
  const receipt = createReceipt({ operation: request.operation, intelligence_mode: "deterministic", provider: "sovereign-pipeline", model: null, context_sources: request.contextSources ?? [], policy: "default deny; capability is not authority", verification: detail, result_state: failure });
  traceStage(trace, "RECEIPT", "completed", receipt.receipt_id);
  return { status: "BLOCKED", failure, trace, receipt };
}
