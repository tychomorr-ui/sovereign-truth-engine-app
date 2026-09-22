export const TRUTH_STATES = ["UNKNOWN", "DECLARED", "OBSERVED", "DOCUMENTED", "VERIFIED", "AUTHORIZED", "EXECUTED", "COMPLETED", "ATTESTED", "REVOKED", "DISPROVEN", "FAILED", "UNDER_REVIEW"] as const;
export type TruthState = (typeof TRUTH_STATES)[number];

export const INFORMATION_STATES = ["KNOWN", "UNKNOWN", "INFERRED", "CONFLICTED", "STALE", "UNAVAILABLE", "UNAUTHORIZED_TO_ACCESS"] as const;
export type InformationState = (typeof INFORMATION_STATES)[number];

const transitions: Record<TruthState, readonly TruthState[]> = {
  UNKNOWN: ["DECLARED", "OBSERVED", "DOCUMENTED", "UNDER_REVIEW", "FAILED"],
  DECLARED: ["DOCUMENTED", "OBSERVED", "UNDER_REVIEW", "REVOKED", "DISPROVEN"],
  OBSERVED: ["DOCUMENTED", "VERIFIED", "UNDER_REVIEW", "REVOKED", "DISPROVEN", "FAILED"],
  DOCUMENTED: ["VERIFIED", "UNDER_REVIEW", "REVOKED", "DISPROVEN", "FAILED"],
  VERIFIED: ["AUTHORIZED", "EXECUTED", "COMPLETED", "ATTESTED", "REVOKED", "DISPROVEN", "UNDER_REVIEW"],
  AUTHORIZED: ["EXECUTED", "REVOKED", "FAILED", "UNDER_REVIEW"],
  EXECUTED: ["COMPLETED", "FAILED", "UNDER_REVIEW"],
  COMPLETED: ["ATTESTED", "REVOKED", "UNDER_REVIEW"],
  ATTESTED: ["REVOKED", "DISPROVEN", "UNDER_REVIEW"],
  REVOKED: [],
  DISPROVEN: ["UNDER_REVIEW", "REVOKED"],
  FAILED: ["UNDER_REVIEW", "REVOKED"],
  UNDER_REVIEW: ["DECLARED", "OBSERVED", "DOCUMENTED", "VERIFIED", "REVOKED", "DISPROVEN", "FAILED"],
};

export type TruthTransition = { allowed: boolean; from: TruthState; to: TruthState; reason: string };

export function canTransition(from: TruthState, to: TruthState): TruthTransition {
  if (from === to) return { allowed: true, from, to, reason: "state unchanged" };
  const allowed = transitions[from].includes(to);
  return { allowed, from, to, reason: allowed ? "defined transition" : `transition ${from} → ${to} is not defined` };
}

export function transitionTruthState(from: TruthState, to: TruthState): TruthTransition {
  const transition = canTransition(from, to);
  if (!transition.allowed) throw new Error(transition.reason);
  return transition;
}

export type InformationClassificationInput = { value?: unknown; declared?: boolean; observed?: boolean; verified?: boolean; stale?: boolean; conflicted?: boolean; authorized?: boolean; sources?: string[] };

export function classifyInformation(input: InformationClassificationInput): InformationState {
  if (!input.authorized) return "UNAUTHORIZED_TO_ACCESS";
  if (input.value === undefined || input.value === null || input.value === "") return "UNKNOWN";
  if (input.conflicted) return "CONFLICTED";
  if (input.stale) return "STALE";
  if (input.verified) return "KNOWN";
  if (input.observed || input.declared) return "INFERRED";
  return "UNKNOWN";
}
