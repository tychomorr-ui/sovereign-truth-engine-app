import { createHash, randomUUID } from "node:crypto";
import { deterministicResponse, type LocalChatMessage } from "./local-gateway";
import { getConfiguredLocalModelProvider, type ContextBoundary, type LocalModelProvider, type ModelResult } from "./local-model";
import type { IntelligenceReceipt } from "./sovereign-bus";

export type ResponseContract = "EXPLANATION" | "SUMMARY" | "CLASSIFICATION" | "EVIDENCE_REVIEW" | "NEXT_STEP" | "PROPOSAL" | "DIAGNOSTIC" | "ADJUDICATION_INPUT";
export type ClaimState = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED_BY_CURRENT_EVIDENCE" | "CONTRADICTED_BY_CURRENT_EVIDENCE" | "UNKNOWN";
export type Confidence = "low" | "medium" | "high";
export type ProvenanceState = "KNOWN" | "UNKNOWN" | "INFERRED" | "CONFLICTED" | "UNAVAILABLE";

export type ContextField = { name: string; value: unknown; source: string; provenance: ProvenanceState; authorized: boolean; necessary: boolean };
export type GovernedContext = {
  request: ContextField;
  intent: ContextField;
  authorized_state: ContextField;
  relevant_knowledge: ContextField[];
  evidence: ContextField[];
  provenance: ContextField[];
  constraints: ContextField[];
  authority: ContextField;
  allowed_actions: ContextField[];
  forbidden_actions: ContextField[];
  response_contract: ContextField;
  runtime: ContextField;
  receipt_context: ContextField;
  context_hash: string;
};

export type CandidateClaim = { claim: string; evidence_refs: string[]; state?: ClaimState };
export type StructuredModelOutput = { answer: string; claims: CandidateClaim[]; evidence_refs: string[]; unknowns: string[]; proposed_next_step: string; confidence: Confidence };
export type AdjudicatedClaim = CandidateClaim & { state: ClaimState; matched_evidence: string[] };
export type GovernedResult = { answer: string; claims: AdjudicatedClaim[]; unknowns: string[]; proposed_next_step: string; confidence: Confidence; usedLocalModel: boolean; fallback: boolean; model: { id: string; provider: string; runtime: string | null; version: string | null; modelHash: string | null }; receipt: IntelligenceReceipt; context: GovernedContext };

const CONTRACT_RULES: Record<ResponseContract, string> = {
  EXPLANATION: "Explain only from authorized context; distinguish known, inferred, and unknown information.",
  SUMMARY: "Summarize only supplied authorized context; do not add unsupported facts.",
  CLASSIFICATION: "Return a classification and the evidence or unknowns supporting it.",
  EVIDENCE_REVIEW: "Review candidate claims against supplied evidence and mark unresolved claims unknown.",
  NEXT_STEP: "Suggest a bounded next step without executing it or changing state.",
  PROPOSAL: "Return a proposal only; proposals are not authorization or execution.",
  DIAGNOSTIC: "Diagnose only from supplied runtime evidence and state limitations explicitly.",
  ADJUDICATION_INPUT: "Return candidate claims and evidence references for deterministic adjudication; do not decide truth.",
};

const SYSTEM_CONTRACT = "You are a local transformation engine operating inside a deterministic sovereign runtime. You do not have authority. You do not determine truth. You do not create permissions. You do not execute actions. You may only transform the authorized context you receive. Do not invent missing evidence. If information is absent, return UNKNOWN. If a claim is unsupported by supplied evidence, mark it UNSUPPORTED. Return only the requested schema.";

export const GOVERNED_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "claims", "evidence_refs", "unknowns", "proposed_next_step", "confidence"],
  properties: {
    answer: { type: "string" },
    claims: { type: "array", items: { type: "object", additionalProperties: false, required: ["claim", "evidence_refs"], properties: { claim: { type: "string" }, evidence_refs: { type: "array", items: { type: "string" } } } } },
    evidence_refs: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
    proposed_next_step: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
};

function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function field(name: string, value: unknown, source: string, provenance: ProvenanceState, authorized = true, necessary = true): ContextField { return { name, value, source, provenance, authorized, necessary }; }
function assertField(input: ContextField): void { if (!input.source.trim()) throw new Error(`context field ${input.name} has no source`); if (!input.provenance) throw new Error(`context field ${input.name} has no provenance`); if (!input.authorized) throw new Error(`context field ${input.name} is unauthorized`); if (!input.necessary) throw new Error(`context field ${input.name} is unnecessary`); }

export function assembleGovernedContext(input: {
  request: string;
  intent: string;
  authority: string;
  contextSources?: ContextField[];
  evidence?: ContextField[];
  constraints?: ContextField[];
  allowedActions?: ContextField[];
  forbiddenActions?: ContextField[];
  responseContract: ResponseContract;
  runtime: string;
}): GovernedContext {
  const context: GovernedContext = {
    request: field("request", input.request, "operator.request", "KNOWN"),
    intent: field("intent", input.intent, "deterministic.intent-extractor", "INFERRED"),
    authorized_state: field("authorized_state", "operator-authorized context only", "deterministic.authority-gate", "KNOWN"),
    relevant_knowledge: (input.contextSources ?? []).filter((item) => item.authorized && item.necessary),
    evidence: (input.evidence ?? []).filter((item) => item.authorized && item.necessary),
    provenance: [...(input.contextSources ?? []), ...(input.evidence ?? [])].map((item) => field(`${item.name}.provenance`, item.provenance, item.source, "KNOWN")),
    constraints: input.constraints ?? [field("external_ai", false, "deterministic.policy", "KNOWN"), field("network_egress", "NONE", "deterministic.policy", "KNOWN")],
    authority: field("authority", input.authority, "deterministic.root-authority", "KNOWN"),
    allowed_actions: input.allowedActions ?? [],
    forbidden_actions: input.forbiddenActions ?? [field("arbitrary_tools", "forbidden", "deterministic.policy", "KNOWN")],
    response_contract: field("response_contract", input.responseContract, "deterministic.response-contract", "KNOWN"),
    runtime: field("runtime", input.runtime, "deterministic.runtime-discovery", "KNOWN"),
    receipt_context: field("receipt_context", "local-only governed generation", "deterministic.receipt-contract", "KNOWN"),
    context_hash: "",
  };
  const fields = [context.request, context.intent, context.authorized_state, ...context.relevant_knowledge, ...context.evidence, ...context.provenance, ...context.constraints, context.authority, ...context.allowed_actions, ...context.forbidden_actions, context.response_contract, context.runtime, context.receipt_context];
  fields.forEach(assertField);
  context.context_hash = hash(fields);
  return context;
}

function extractJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(trimmed); } catch { throw new Error("STRUCTURED_OUTPUT_INVALID: response is not valid JSON"); }
}

export function validateStructuredOutput(value: unknown): StructuredModelOutput {
  if (!value || typeof value !== "object") throw new Error("STRUCTURED_OUTPUT_INVALID: output is not an object");
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.answer !== "string" || !Array.isArray(candidate.claims) || !Array.isArray(candidate.evidence_refs) || !Array.isArray(candidate.unknowns) || typeof candidate.proposed_next_step !== "string" || !["low", "medium", "high"].includes(String(candidate.confidence))) throw new Error("STRUCTURED_OUTPUT_INVALID: response contract mismatch");
  const claims = candidate.claims.map((claim) => {
    if (!claim || typeof claim !== "object" || typeof (claim as Record<string, unknown>).claim !== "string" || !Array.isArray((claim as Record<string, unknown>).evidence_refs)) throw new Error("STRUCTURED_OUTPUT_INVALID: malformed claim");
    return { claim: String((claim as Record<string, unknown>).claim), evidence_refs: ((claim as Record<string, unknown>).evidence_refs as unknown[]).filter((ref): ref is string => typeof ref === "string") };
  });
  return { answer: candidate.answer, claims, evidence_refs: candidate.evidence_refs.filter((ref): ref is string => typeof ref === "string"), unknowns: candidate.unknowns.filter((item): item is string => typeof item === "string"), proposed_next_step: candidate.proposed_next_step, confidence: candidate.confidence as Confidence };
}

function normalizeClaim(value: string): string { return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
function adjudicateClaim(claim: CandidateClaim, evidence: ContextField[]): AdjudicatedClaim {
  const normalized = normalizeClaim(claim.claim);
  const matched = evidence.filter((item) => claim.evidence_refs.includes(item.source) || normalizeClaim(String(item.value)).includes(normalized) || normalized.includes(normalizeClaim(String(item.value)))).map((item) => item.source);
  const contradiction = evidence.some((item) => item.provenance === "CONFLICTED" || (normalizeClaim(String(item.value)).includes("not ") && normalized.replace(/\bnot\b/g, "").trim() === normalizeClaim(String(item.value)).replace(/\bnot\b/g, "").trim()));
  const state: ClaimState = contradiction ? "CONTRADICTED_BY_CURRENT_EVIDENCE" : matched.length === 0 ? "UNSUPPORTED_BY_CURRENT_EVIDENCE" : matched.length < claim.evidence_refs.length ? "PARTIALLY_SUPPORTED" : "SUPPORTED";
  return { ...claim, state, matched_evidence: matched };
}

export function adjudicateClaims(output: StructuredModelOutput, evidence: ContextField[]): AdjudicatedClaim[] { return output.claims.map((claim) => adjudicateClaim(claim, evidence)); }
function compileAnswer(output: StructuredModelOutput, claims: AdjudicatedClaim[]): string { const flagged = claims.filter((claim) => claim.state !== "SUPPORTED"); const flags = flagged.length ? `\n\nEvidence status: ${flagged.map((claim) => `${claim.state}: ${claim.claim}`).join("; ")}` : "\n\nEvidence status: SUPPORTED"; return `${output.answer.trim()}${flags}\n\nUnknowns: ${output.unknowns.length ? output.unknowns.join("; ") : "None stated by the model."}`; }
function modelMetadata(provider: LocalModelProvider): { id: string; provider: string; runtime: string | null; version: string | null; modelHash: string | null } { const info = (provider as { model?: string; runtime?: string }).model; return { id: info ?? "unavailable", provider: "local", runtime: (provider as { runtime?: string }).runtime ?? null, version: null, modelHash: null }; }
function receiptFor(input: { context: GovernedContext; model: { id: string; provider: string; runtime: string | null; version: string | null; modelHash: string | null }; resultState: string; verification: string; usedLocalModel: boolean; fallback: boolean }): IntelligenceReceipt { return { receipt_id: randomUUID(), timestamp: new Date().toISOString(), operation: "governed.local-generation", intelligence_mode: input.usedLocalModel ? "local_model" : "deterministic", provider: input.model.provider, model: input.model.id, context_sources: [input.context.context_hash, ...input.context.evidence.map((item) => item.source)], external_service_used: false, data_left_local_node: false, policy: "deterministic governor; external_ai=false; network_egress=NONE", verification: input.verification, result_state: input.resultState }; }

export async function runGovernedLocalGeneration(input: { request: string; intent: string; authority: string; responseContract: ResponseContract; runtime: string; contextSources?: ContextField[]; evidence?: ContextField[]; constraints?: ContextField[]; provider?: LocalModelProvider; modelAvailable?: boolean }): Promise<GovernedResult> {
  const context = assembleGovernedContext(input);
  const provider = input.provider ?? getConfiguredLocalModelProvider();
  const modelAvailable = input.modelAvailable ?? Boolean((await provider.modelInfo()).health.generationAvailable);
  const contractInstruction = `${SYSTEM_CONTRACT}\nResponse contract: ${input.responseContract}. ${CONTRACT_RULES[input.responseContract]}\nReturn JSON with answer, claims[{claim,evidence_refs}], evidence_refs, unknowns, proposed_next_step, confidence(low|medium|high).`;
  let output: StructuredModelOutput;
  let model = modelMetadata(provider);
  let usedLocalModel = false;
  let fallback = false;
  if (modelAvailable) {
    const request: { system: string; messages: LocalChatMessage[]; contextBoundary: ContextBoundary; maxTokens: number } = { system: contractInstruction, messages: [{ role: "user", content: JSON.stringify(context) }], contextBoundary: "LOCAL_ONLY", maxTokens: 1200 };
    try {
      const raw: ModelResult = provider.generateStructured
        ? await provider.generateStructured(request, GOVERNED_OUTPUT_SCHEMA)
        : await provider.generate(request);
      output = validateStructuredOutput(extractJson(raw.content));
      usedLocalModel = true;
      model = { id: raw.modelId, provider: raw.provider, runtime: null, version: null, modelHash: null };
    } catch {
      fallback = true;
      const deterministic = deterministicResponse({ system: contractInstruction, messages: [{ role: "user", content: input.request }], contextBoundary: "LOCAL_ONLY" });
      output = { answer: deterministic.content, claims: [], evidence_refs: [], unknowns: ["local model unavailable or structured output invalid"], proposed_next_step: "Inspect local model health and retry under the same policy.", confidence: "low" };
      model = { id: deterministic.modelId, provider: deterministic.provider, runtime: null, version: null, modelHash: null };
    }
  } else {
    fallback = true;
    const deterministic = deterministicResponse({ system: contractInstruction, messages: [{ role: "user", content: input.request }], contextBoundary: "LOCAL_ONLY" });
    output = { answer: deterministic.content, claims: [], evidence_refs: [], unknowns: ["local model unavailable"], proposed_next_step: "Install and health-check an approved local model before requesting generative transformation.", confidence: "low" };
    model = { id: deterministic.modelId, provider: deterministic.provider, runtime: null, version: null, modelHash: null };
  }
  const claims = adjudicateClaims(output, context.evidence);
  const resultState = fallback ? "DETERMINISTIC_FALLBACK" : "GENERATED_INFERENCE_ADJUDICATED";
  const receipt = receiptFor({ context, model, resultState, usedLocalModel, fallback, verification: claims.every((claim) => claim.state === "SUPPORTED" || claim.state === "UNKNOWN") ? "structured output validated; claims adjudicated; unsupported claims not promoted" : "structured output validated; contradictory or unsupported claims explicitly flagged" });
  return { answer: compileAnswer(output, claims), claims, unknowns: output.unknowns, proposed_next_step: output.proposed_next_step, confidence: output.confidence, usedLocalModel, fallback, model, receipt, context };
}
