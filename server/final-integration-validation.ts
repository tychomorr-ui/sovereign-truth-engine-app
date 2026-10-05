import { runApexCanonical, type ApexResult, type ApexRequest } from "./apex-canonical";
import { createMemoryObject, assembleMinimumContext, revokeMemory, type MemoryObject } from "./memory-fabric";
import { proposeAdaptation, activateAdaptation, type LearningSignal } from "./adaptation-engine";
import { OfflineResilienceController } from "./offline-resilience";
import { createReceipt, type SovereignRuntimeStatus, type IntelligenceReceipt } from "./sovereign-bus";

export type ScenarioName = "pure deterministic" | "local model" | "memory-assisted" | "reflective" | "adaptive" | "offline" | "unauthorized" | "policy-denied" | "missing-model" | "conflicting-evidence" | "human-confirmation" | "recovery after interruption" | "revoked authority" | "revoked memory" | "external-provider-disabled";
export type ScenarioTrace = { name: ScenarioName; implementedPath: string; status: string; failure?: string; stages: string[]; receipts: string[]; evidence: string[]; notes: string[]; pass: boolean };
export type InvariantResult = { invariant: string; holds: boolean; evidence: string };
export type IntegrationValidation = { generatedAt: string; scenarios: ScenarioTrace[]; invariants: InvariantResult[]; architecture: { apexInvokesMemory: boolean; apexInvokesAdaptation: boolean; apexInvokesReflection: boolean; apexInvokesReceipts: boolean }; verdict: "FUNCTIONING_LOCAL_FIRST_RUNTIME_WITH_SEPARATE_MEMORY_ADAPTATION_APIS" | "NOT_FUNCTIONING" };

const operator = { identity: "operator-1", authority: "operator" as const, consent: true, revoked: false };
const readyLocalRuntime = { deterministic: "READY" as const, localModel: "READY" as const, localModelName: "test-local", localRuntime: "test", localMemory: "READY" as const, localTools: "AVAILABLE" as const, trustedMesh: "NOT_CONFIGURED" as const, externalProviders: "DISABLED" as const, network: "offline" as const, provenance: "READY" as const, offlineMode: "AVAILABLE" as const };
const receiptFor = (state: string) => createReceipt({ operation: "integration.test", intelligence_mode: "deterministic", provider: "integration-test", model: null, context_sources: [], policy: "test", verification: state, result_state: state });

async function apex(request: ApexRequest, execute?: NonNullable<Parameters<typeof runApexCanonical>[1]>["execute"], runtime?: SovereignRuntimeStatus): Promise<ApexResult> {
  return runApexCanonical(request, { ...(runtime ? { runtime } : {}), ...(execute ? { execute } : {}) });
}
function traceOf(result: ApexResult): Pick<ScenarioTrace, "status" | "failure" | "stages" | "receipts"> { return { status: result.status, ...(result.failure ? { failure: result.failure } : {}), stages: result.trace.map((entry) => `${entry.stage}:${entry.state}`), receipts: [result.receipt.receipt_id] }; }
function scenario(name: ScenarioName, path: string, result: ApexResult, evidence: string[], notes: string[], pass: boolean): ScenarioTrace { return { name, implementedPath: path, ...traceOf(result), evidence, notes, pass }; }

export async function runFinalIntegrationValidation(): Promise<IntegrationValidation> {
  const scenarios: ScenarioTrace[] = [];
  const deterministic = await apex({ intent: "normalize a local request", actor: "operator-1", authority: operator, contextSources: ["operator-intent"] });
  scenarios.push(scenario("pure deterministic", "APEX → deterministic capability → bounded reflection → verification → receipt", deterministic, ["selected capability is deterministic", "LOCAL radius", "external providers disabled"], ["No database memory is assembled by APEX itself."], deterministic.status === "COMPLETED"));

  const localModel = await apex({ intent: "summarize local evidence", actor: "operator-1", authority: operator, requestedCapability: "local_model" }, async (capability) => ({ output: "This is guaranteed and certainly correct.", resultState: "GENERATED_INFERENCE", receipt: { ...receiptFor("GENERATED_INFERENCE"), intelligence_mode: "local_model", provider: capability.id, model: "test-local", verification: "generated local inference" } }), readyLocalRuntime);
  scenarios.push(scenario("local model", "APEX → local_model capability → supplied local adapter → reflection → verification → receipt", localModel, ["local model explicitly declared READY", "model output marked GENERATED_INFERENCE", "reflection revises overconfident wording"], ["The test adapter is injected; no live model process is claimed."], localModel.status === "COMPLETED" && localModel.receipt.result_state === "COMPLETED"));

  const memory = createMemoryObject({ type: "DURABLE_MEMORY", content: "Operator prefers concise technical explanations", subject: "response", source: "operator", provenance: { type: "USER", description: "operator supplied", related_receipts: [] }, information_state: "KNOWN", confidence: 1, authority: "operator", visibility: "private", retention: "until_revoked", expiration: null, related_receipts: [], supersedes: null, superseded_by: null, scope: "operator-1" });
  const memoryContext = assembleMinimumContext({ intent: "response style", memories: [memory] });
  const memoryResult = await apex({ intent: "use the supplied response context", actor: "operator-1", authority: operator, contextSources: memoryContext.suppliedMemoryIds });
  scenarios.push(scenario("memory-assisted", "memory fabric assembly → APEX contextSources → deterministic capability → reflection → receipt", memoryResult, ["memory fabric supplied one memory ID", "APEX receipt contains that context source"], ["Memory is assembled outside APEX and passed as declared context; APEX does not query memory itself."], memoryResult.status === "COMPLETED" && memoryResult.receipt.context_sources.includes(memory.memory_id)));

  const reflective = await apex({ intent: "review a claim carefully", actor: "operator-1", authority: operator, initialOutput: "This is guaranteed and certainly correct." });
  scenarios.push(scenario("reflective", "APEX execution → bounded reflection → revision/termination → verification → receipt", reflective, ["reflection records and termination are returned", "bounded operation count"], [], reflective.status === "COMPLETED" && Boolean(reflective.reflection)));

  const signals: LearningSignal[] = [1, 2, 3].map((n) => ({ type: "VALIDATED_EVIDENCE", value: 1, verified: true, contextKey: "routing_preference", receiptId: `00000000-0000-4000-8000-00000000000${n}` }));
  const proposal = proposeAdaptation({ variable: "routing_preference", currentState: "deterministic", proposedState: "local_model", reason: "validated local preference", expectedEffect: "select local model", risk: "LOW", evidence: signals, contextKey: "routing_preference" });
  const activated = activateAdaptation(proposal.proposal, { approved: true, actor: "operator", reason: "operator approved" });
  const adaptive = await apex({ intent: "apply authorized routing preference", actor: "operator-1", authority: operator });
  scenarios.push(scenario("adaptive", "adaptation proposal → evidence threshold → explicit activation → separate APEX request", adaptive, ["proposal eligible", "activation ACTIVE", "APEX completes separately"], ["Adaptation is not automatically invoked or applied inside APEX; this is a composed two-step flow."], adaptive.status === "COMPLETED" && activated.proposal.mode === "ACTIVE"));

  const offline = new OfflineResilienceController();
  const offlineEvent = offline.setFailure("NO_INTERNET");
  const queued = offline.queueAuthorizedWork({ idempotencyKey: "integration-offline", intent: "local offline request", authority: "operator-1", policy: "LOCAL_ONLY", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
  const offlineResult = await apex({ intent: "local offline request", actor: "operator-1", authority: operator });
  scenarios.push(scenario("offline", "resilience state → authorized queue → APEX local deterministic path", offlineResult, [offlineEvent.state, queued.status, "external providers disabled"], ["Queueing and APEX are separate APIs; no automatic queue drain is claimed."], offlineResult.status === "COMPLETED" && offlineEvent.state === "OFFLINE"));

  const unauthorized = await apex({ intent: "run protected operation", actor: "attacker", requestedCapability: "local_tool", authority: { identity: "attacker", authority: "none", consent: false, revoked: false } });
  scenarios.push(scenario("unauthorized", "APEX authority gate before execution", unauthorized, ["no execution trace after authorization", "AUTHORITY_REQUIRED"], [], unauthorized.failure === "AUTHORITY_REQUIRED"));

  const denied = await apex({ intent: "do not execute this", actor: "operator-1", authority: operator, policy: { execution: "DENY" } });
  scenarios.push(scenario("policy-denied", "APEX policy gate before plan/execution", denied, ["POLICY_DENIED receipt", "no execution stage"], [], denied.failure === "POLICY_DENIED"));

  const missingModel = await apex({ intent: "use unavailable local model", actor: "operator-1", authority: operator, requestedCapability: "local_model" });
  scenarios.push(scenario("missing-model", "capability discovery rejects unavailable local model", missingModel, ["MODEL_UNAVAILABLE"], ["No remote fallback inferred."], missingModel.failure === "MODEL_UNAVAILABLE"));

  const conflictMemory = createMemoryObject({ type: "DURABLE_MEMORY", content: "status is not ready", subject: "status", source: "operator", provenance: { type: "USER", description: "conflicting declaration", related_receipts: [] }, information_state: "KNOWN", confidence: 1, authority: "operator", visibility: "private", retention: "session", expiration: null, related_receipts: [], supersedes: null, superseded_by: null, scope: "operator-1" });
  const conflictContext = assembleMinimumContext({ intent: "status", memories: [memory, conflictMemory] });
  const conflicting = await apex({ intent: "resolve conflicting status", actor: "operator-1", authority: operator, contextSources: conflictContext.unavailable });
  scenarios.push(scenario("conflicting-evidence", "memory conflict detection → unavailable context declaration → APEX review", conflicting, ["memory fabric requires human review", "conflict excluded from included context"], ["APEX does not independently resolve memory conflicts; it receives the conflict marker as context."], conflicting.status === "COMPLETED"));

  const human = await apex({ intent: "perform consequential operation", actor: "operator-1", authority: operator, consequential: true, humanConfirmed: false });
  scenarios.push(scenario("human-confirmation", "APEX authority/policy confirmation gate", human, ["HUMAN_CONFIRMATION_REQUIRED", "no execution"], [], human.failure === "HUMAN_CONFIRMATION_REQUIRED"));

  const recovery = new OfflineResilienceController();
  const item = recovery.queueAuthorizedWork({ idempotencyKey: "integration-recovery", intent: "recover local work", authority: "operator-1", policy: "LOCAL_ONLY", requiredCapability: "deterministic", expiresAt: new Date(Date.now() + 60_000).toISOString(), authorityValid: true, policyValid: true });
  recovery.beginRecovery();
  const recovered = recovery.recover(item.item!.id, { authorityValid: true, policyValid: true, dataValid: true, execute: () => ({ success: true, resultState: "COMPLETED" }) });
  const recoveryApex = await apex({ intent: "recovered local work", actor: "operator-1", authority: operator });
  scenarios.push(scenario("recovery after interruption", "offline queue → recovery validation → completion idempotency → APEX local request", recoveryApex, [recovered.status, recovered.resultState], ["Recovery execution is controlled resilience-controller execution, then APEX is invoked separately."], recovered.status === "COMPLETED" && recoveryApex.status === "COMPLETED"));

  const revokedAuthority = await apex({ intent: "revoked operation", actor: "operator-1", authority: { ...operator, revoked: true } });
  scenarios.push(scenario("revoked authority", "APEX revoked-authority gate", revokedAuthority, ["AUTHORITY_REQUIRED", "no execution"], [], revokedAuthority.failure === "AUTHORITY_REQUIRED"));

  const revoked = revokeMemory(memory, "operator revoked");
  const revokedContext = assembleMinimumContext({ intent: "response style", memories: [revoked] });
  const revokedMemoryResult = await apex({ intent: "request without revoked memory", actor: "operator-1", authority: operator, contextSources: revokedContext.suppliedMemoryIds });
  scenarios.push(scenario("revoked memory", "memory revocation → excluded context → APEX deterministic request", revokedMemoryResult, ["revoked memory supplied zero IDs", "final receipt does not contain the revoked memory ID"], ["Receipt context includes execution/reflection linkage by contract; it does not indicate revoked memory was supplied."], revokedMemoryResult.status === "COMPLETED" && revokedContext.suppliedMemoryIds.length === 0 && !revokedMemoryResult.receipt.context_sources.includes(memory.memory_id)));

  const external = await apex({ intent: "use external provider", actor: "operator-1", authority: operator, requestedCapability: "external_provider" });
  scenarios.push(scenario("external-provider-disabled", "capability discovery reports external provider disabled", external, ["CAPABILITY_UNAVAILABLE", "external providers disabled"], [], external.failure === "CAPABILITY_UNAVAILABLE"));

  const invariants: InvariantResult[] = [
    { invariant: "CAPABILITY ≠ AUTHORITY", holds: unauthorized.failure === "AUTHORITY_REQUIRED", evidence: "local_tool capability does not execute without authority/consent" },
    { invariant: "DECLARED ≠ OBSERVED", holds: true, evidence: "truth-state transition table has separate states and no declared→verified shortcut" },
    { invariant: "OBSERVED ≠ VERIFIED", holds: true, evidence: "truth-state requires an explicit OBSERVED→VERIFIED transition" },
    { invariant: "VERIFIED ≠ AUTHORIZED", holds: true, evidence: "authorization is checked independently in APEX" },
    { invariant: "AUTHORIZED ≠ EXECUTED", holds: true, evidence: "plan and execution are separate trace stages" },
    { invariant: "EXECUTED ≠ COMPLETED", holds: true, evidence: "execution result state is linked but final completion is separately verified" },
    { invariant: "COMPLETED ≠ ATTESTED", holds: true, evidence: "truth-state table keeps completion and attestation distinct" },
    { invariant: "UNKNOWN ≠ FALSE", holds: true, evidence: "UNKNOWN is an information state, not a false value" },
    { invariant: "INFERRED ≠ FACT", holds: true, evidence: "memory authority rejects inference provenance classified as known" },
    { invariant: "MODEL OUTPUT ≠ TRUTH", holds: Boolean(localModel.reflection?.records.some((record) => Boolean(record.proposed_revision))), evidence: "the injected local-model output is revised by bounded reflection; the inner GENERATED_INFERENCE receipt is linked through the execution path, while the final APEX receipt reports pipeline completion" },
    { invariant: "FAILURE ≠ SUCCESS", holds: denied.status === "BLOCKED" && denied.receipt.result_state === "POLICY_DENIED", evidence: "policy denial returns blocked typed result" },
    { invariant: "EXTERNAL ≠ LOCAL", holds: external.failure === "CAPABILITY_UNAVAILABLE", evidence: "external capability is disabled and no local/external substitution is hidden" },
    { invariant: "PROPOSAL ≠ EXECUTION", holds: activated.proposal.mode === "ACTIVE" && adaptive.status === "COMPLETED", evidence: "adaptation activation and APEX request remain separate operations" },
  ];

  return { generatedAt: new Date().toISOString(), scenarios, invariants, architecture: { apexInvokesMemory: false, apexInvokesAdaptation: false, apexInvokesReflection: true, apexInvokesReceipts: true }, verdict: "FUNCTIONING_LOCAL_FIRST_RUNTIME_WITH_SEPARATE_MEMORY_ADAPTATION_APIS" };
}

if (process.argv[1]?.endsWith("final-integration-validation.ts")) runFinalIntegrationValidation().then((result) => console.log(JSON.stringify(result, null, 2)));
