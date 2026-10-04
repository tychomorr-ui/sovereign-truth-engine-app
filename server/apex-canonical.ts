import { createReceipt, resolveCapabilities, routeLocalConversation, type CapabilityId, type IntelligenceReceipt, type SovereignRuntimeStatus } from "./sovereign-bus";
import { runBoundedReflection, type BoundedReflectionResult } from "./reflection-engine";

export type ComputationalRadius = "LOCAL" | "EDGE" | "MESH" | "FEDERATION" | "CLOUD";
export type ApexStage = "INTENT" | "CONTEXT" | "CAPABILITY_DISCOVERY" | "AUTHORIZATION" | "POLICY" | "PLAN" | "EXECUTION" | "REFLECTION" | "VERIFICATION" | "RECEIPT";
export type ApexFailure = "AUTHORITY_REQUIRED" | "POLICY_DENIED" | "CAPABILITY_UNAVAILABLE" | "MODEL_UNAVAILABLE" | "EVIDENCE_INSUFFICIENT" | "VERIFICATION_FAILED" | "HUMAN_CONFIRMATION_REQUIRED" | "NETWORK_UNAVAILABLE" | "PROVIDER_FAILURE" | "RESOURCE_LIMIT";
export type ApexTraceEntry = { stage: ApexStage; state: "entered" | "completed" | "blocked"; detail: string; at: string };
export type ApexCapability = { id: CapabilityId; state: string; radius: ComputationalRadius; local: boolean; requiresNetwork: boolean; requiresExternalProvider: boolean; requiresAuthorization: boolean };
export type ApexAuthority = { identity: string; authority: "operator" | "system" | "delegated" | "none"; consent: boolean; delegation?: string; revoked: boolean };
export type ApexPolicy = { data: "LOCAL_ONLY" | "DECLARED"; execution: "ALLOW" | "DENY"; privacy: "LOCAL" | "DECLARED"; network: "OFFLINE" | "AVAILABLE" | "UNAVAILABLE"; tool: "ALLOW" | "DENY"; model: "ALLOW" | "DENY"; humanConfirmationRequired: boolean; resourceLimitMs: number };
export type ApexPlan = { goal: string; steps: string[]; capability: CapabilityId; radius: ComputationalRadius; authority: ApexAuthority; constraints: string[]; expectedOutputs: string[]; verification: string[]; rollback: string; humanConfirmation: boolean };
export type ApexRequest = { intent: string; actor: string; contextSources?: string[]; requestedCapability?: CapabilityId; requestedRadius?: ComputationalRadius; authority?: ApexAuthority; policy?: Partial<ApexPolicy>; consequential?: boolean; humanConfirmed?: boolean; initialOutput?: string };
export type ApexResult = { status: "COMPLETED" | "BLOCKED" | "FAILED"; output?: string; failure?: ApexFailure; selectedCapability?: ApexCapability; plan?: ApexPlan; reflection?: Pick<BoundedReflectionResult, "decision" | "terminationReason" | "iterations" | "operations" | "records">; trace: ApexTraceEntry[]; receipt: IntelligenceReceipt };

const RADIUS_ORDER: ComputationalRadius[] = ["LOCAL", "EDGE", "MESH", "FEDERATION", "CLOUD"];
const now = () => new Date().toISOString();
function mark(trace: ApexTraceEntry[], stage: ApexStage, state: ApexTraceEntry["state"], detail: string) { trace.push({ stage, state, detail, at: now() }); }
function fail(request: ApexRequest, trace: ApexTraceEntry[], failure: ApexFailure, detail: string): ApexResult { mark(trace, trace.at(-1)?.stage ?? "INTENT", "blocked", detail); const receipt = createReceipt({ operation: "apex.canonical", intelligence_mode: "deterministic", provider: "apex-canonical", model: null, context_sources: request.contextSources ?? [], policy: "APEX default deny; capability is not authority", verification: detail, result_state: failure }); mark(trace, "RECEIPT", "completed", receipt.receipt_id); return { status: "BLOCKED", failure, trace, receipt }; }

export function discoverApexCapabilities(runtime: SovereignRuntimeStatus = { deterministic: "READY", localModel: "NOT_CONFIGURED", localModelName: null, localRuntime: null, localMemory: "READY", localTools: "AVAILABLE", trustedMesh: "NOT_CONFIGURED", externalProviders: "DISABLED", network: "offline", provenance: "READY", offlineMode: "AVAILABLE" }): ApexCapability[] {
  const capabilities = resolveCapabilities();
  return [
    { id: "deterministic", state: runtime.deterministic || capabilities.deterministic, radius: "LOCAL", local: true, requiresNetwork: false, requiresExternalProvider: false, requiresAuthorization: false },
    { id: "local_model", state: runtime.localModel || capabilities.local_model, radius: "LOCAL", local: true, requiresNetwork: false, requiresExternalProvider: false, requiresAuthorization: false },
    { id: "local_tool", state: runtime.localTools || capabilities.local_tool, radius: "LOCAL", local: true, requiresNetwork: false, requiresExternalProvider: false, requiresAuthorization: true },
    { id: "trusted_mesh", state: runtime.trustedMesh, radius: "MESH", local: false, requiresNetwork: true, requiresExternalProvider: false, requiresAuthorization: true },
    { id: "external_provider", state: runtime.externalProviders, radius: "CLOUD", local: false, requiresNetwork: true, requiresExternalProvider: true, requiresAuthorization: true },
  ];
}

function chooseCapability(request: ApexRequest, available: ApexCapability[]): ApexCapability | undefined {
  const requested = request.requestedCapability ? available.find((capability) => capability.id === request.requestedCapability) : undefined;
  if (requested && requested.state !== "READY" && requested.state !== "AVAILABLE") return undefined;
  if (requested) return requested;
  const maxRadiusIndex = request.requestedRadius ? RADIUS_ORDER.indexOf(request.requestedRadius) : 0;
  return available.find((capability) => RADIUS_ORDER.indexOf(capability.radius) <= maxRadiusIndex && (capability.state === "READY" || capability.state === "AVAILABLE") && !capability.requiresAuthorization) ?? available.find((capability) => capability.id === "deterministic" && capability.state === "READY");
}

export async function runApexCanonical(request: ApexRequest, options: { runtime?: SovereignRuntimeStatus; execute?: (capability: ApexCapability, plan: ApexPlan) => Promise<{ output: string; resultState: string; receipt: IntelligenceReceipt }> } = {}): Promise<ApexResult> {
  const trace: ApexTraceEntry[] = [];
  mark(trace, "INTENT", "entered", request.intent.trim() ? "intent supplied" : "intent missing");
  if (!request.intent.trim()) return fail(request, trace, "EVIDENCE_INSUFFICIENT", "An explicit intent is required.");
  mark(trace, "INTENT", "completed", request.intent.trim());
  mark(trace, "CONTEXT", "completed", `${request.contextSources?.length ?? 0} declared context source(s)`);
  mark(trace, "CAPABILITY_DISCOVERY", "entered", "discovering local, network, provider, authorization, and unavailable capabilities");
  const available = discoverApexCapabilities(options.runtime);
  const selected = chooseCapability(request, available);
  mark(trace, "CAPABILITY_DISCOVERY", selected ? "completed" : "blocked", selected ? `${selected.id} at ${selected.radius} radius` : "no capability satisfies the declared radius and availability");
  if (!selected) return fail(request, trace, request.requestedCapability === "local_model" ? "MODEL_UNAVAILABLE" : "CAPABILITY_UNAVAILABLE", "Requested capability is unavailable; no remote escalation was inferred.");

  const authority: ApexAuthority = request.authority ?? { identity: request.actor, authority: "none", consent: false, revoked: false };
  mark(trace, "AUTHORIZATION", "completed", `identity=${authority.identity}; authority=${authority.authority}; consent=${authority.consent}; revoked=${authority.revoked}`);
  if (authority.revoked || authority.authority === "none" || (selected.requiresAuthorization && !authority.consent)) return fail(request, trace, "AUTHORITY_REQUIRED", "Authentication does not imply authority; explicit capability consent is required.");
  if (request.consequential && !request.humanConfirmed) return fail(request, trace, "HUMAN_CONFIRMATION_REQUIRED", "Consequential execution requires explicit human confirmation.");

  const policy: ApexPolicy = { data: "LOCAL_ONLY", execution: "ALLOW", privacy: "LOCAL", network: options.runtime?.network === "online" ? "AVAILABLE" : "OFFLINE", tool: "ALLOW", model: "ALLOW", humanConfirmationRequired: Boolean(request.consequential), resourceLimitMs: 1500, ...(request.policy ?? {}) };
  mark(trace, "POLICY", "completed", `data=${policy.data}; network=${policy.network}; execution=${policy.execution}; privacy=${policy.privacy}`);
  if (policy.execution === "DENY" || policy.tool === "DENY" || policy.model === "DENY") return fail(request, trace, "POLICY_DENIED", "Declared policy denied execution.");
  if (selected.requiresNetwork && policy.network !== "AVAILABLE") return fail(request, trace, "NETWORK_UNAVAILABLE", "Selected capability requires network access, but network is unavailable.");
  if (selected.requiresExternalProvider) return fail(request, trace, "POLICY_DENIED", "External providers are disabled in this sovereign release.");

  const plan: ApexPlan = { goal: request.intent, steps: ["execute approved capability", "reflect result through KEIRA", "verify policy, evidence, and expected output", "emit linked receipt"], capability: selected.id, radius: selected.radius, authority, constraints: ["ATMOS smallest safe computational radius", "no arbitrary tools", "no external providers", `resource limit ${policy.resourceLimitMs}ms`], expectedOutputs: ["result text", "reflection state", "verification state"], verification: ["execution completed", "receipt complete", "reflection did not certify inference as truth"], rollback: "no state mutation; discard uncommitted result", humanConfirmation: policy.humanConfirmationRequired };
  mark(trace, "PLAN", "completed", `goal planned with ${selected.id} at ${selected.radius}`);
  mark(trace, "EXECUTION", "entered", "executing only the selected approved capability");
  let execution: { output: string; resultState: string; receipt: IntelligenceReceipt };
  try {
    execution = options.execute ? await options.execute(selected, plan) : await defaultExecute(request, selected);
  } catch (error) {
    return fail(request, trace, "PROVIDER_FAILURE", error instanceof Error ? error.message : "Capability execution failed.");
  }
  mark(trace, "EXECUTION", "completed", execution.resultState);
  mark(trace, "REFLECTION", "entered", "delegating critique and revision to KEIRA reflection engine");
  const reflection = runBoundedReflection({ request: request.intent, initialOutput: execution.output, evidence: request.contextSources, level: 2, limits: { maxReflectionDepth: 2, maxRecursionDepth: 2, maxOperations: 8, maxTimeMs: policy.resourceLimitMs, maxTokens: 4096 }, humanConfirmationRequired: false });
  mark(trace, "REFLECTION", "completed", `${reflection.decision}; ${reflection.terminationReason}`);
  if (reflection.decision === "HUMAN_CONFIRMATION_REQUIRED") return fail(request, trace, "HUMAN_CONFIRMATION_REQUIRED", "Reflection could not resolve a consequential ambiguity.");
  mark(trace, "VERIFICATION", "entered", "verifying execution, evidence, policy, and receipt completeness");
  const output = reflection.decision === "ACCEPT" ? reflection.finalOutput : execution.output;
  if (!output.trim() || !execution.receipt.receipt_id || !selected.id || !plan.goal) return fail(request, trace, "VERIFICATION_FAILED", "Required result, capability, plan, or receipt field is missing.");
  mark(trace, "VERIFICATION", "completed", "execution state, expected output, policy, and receipt fields present");
  const receipt = createReceipt({ operation: "apex.canonical", intelligence_mode: selected.id === "deterministic" ? "deterministic" : "local_model", provider: "apex-canonical", model: null, context_sources: [request.intent, ...(request.contextSources ?? []), execution.receipt.receipt_id, reflection.receipt.receipt_id], policy: "APEX canonical pipeline; ATMOS smallest safe radius; explicit authority; KEIRA reflection", verification: "intent, plan, authority, capability, execution, reflection, and result linked", result_state: "COMPLETED" });
  mark(trace, "RECEIPT", "completed", receipt.receipt_id);
  return { status: "COMPLETED", output, selectedCapability: selected, plan, reflection: { decision: reflection.decision, terminationReason: reflection.terminationReason, iterations: reflection.iterations, operations: reflection.operations, records: reflection.records }, trace, receipt };
}

async function defaultExecute(request: ApexRequest, capability: ApexCapability) {
  if (capability.id === "deterministic" || capability.id === "local_model") {
    const result = await routeLocalConversation({ system: "APEX CANONICAL delegates intelligence to KEIRA. Return an answer without claiming unverified inference is truth.", messages: [{ role: "user", content: request.initialOutput ?? request.intent }], requested: capability.id, operation: "apex.execution", contextSources: request.contextSources ?? [] });
    if (result.status !== "ok" || !result.value) throw new Error(result.reason ?? "Selected capability failed.");
    return { output: result.value.content, resultState: result.receipt.result_state, receipt: result.receipt };
  }
  throw new Error(`Capability ${capability.id} is unavailable in this release.`);
}
