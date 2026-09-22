# KEIRA Stage 2 — Deterministic Intelligence Core

## Purpose

Stage 2 establishes a deterministic intelligence substrate that remains functional without Ollama, llama.cpp, vLLM, internet access, or external APIs. It does not claim that KEIRA is omniscient or that a deterministic interface is equivalent to general intelligence.

## Architecture diagram

```text
KEIRA / Portal Chat
        ↓
Deterministic Intelligence Bus
        ↓
Capability resolution
        ↓
Deterministic capability
        ↓
Decision / state / result
        ↓
Verification
        ↓
Receipt

Capabilities:
  state inspection · input/schema validation · discovery
  authorization · policy · evidence/provenance
  contradiction · confidence/state classification
  routing · workflow transitions · failure/recovery
  resource and recursion limits · receipt generation
```

The implementation is additive. Existing `deterministic-engine.ts`, `sovereign-bus.ts`, `sovereign-pipeline.ts`, receipts, reflection, and local-model boundaries remain intact. Stage 2 adds `truth-state.ts`, `deterministic-core.ts`, and `deterministic-bus.ts` rather than replacing working code.

## Truth state machine

Allowed transitions are explicit; arbitrary promotion is rejected:

```text
UNKNOWN → DECLARED | OBSERVED | DOCUMENTED | UNDER_REVIEW | FAILED
DECLARED → DOCUMENTED | OBSERVED | UNDER_REVIEW | REVOKED | DISPROVEN
OBSERVED → DOCUMENTED | VERIFIED | UNDER_REVIEW | REVOKED | DISPROVEN | FAILED
DOCUMENTED → VERIFIED | UNDER_REVIEW | REVOKED | DISPROVEN | FAILED
VERIFIED → AUTHORIZED | EXECUTED | COMPLETED | ATTESTED | REVOKED | DISPROVEN | UNDER_REVIEW
AUTHORIZED → EXECUTED | REVOKED | FAILED | UNDER_REVIEW
EXECUTED → COMPLETED | FAILED | UNDER_REVIEW
COMPLETED → ATTESTED | REVOKED | UNDER_REVIEW
ATTESTED → REVOKED | DISPROVEN | UNDER_REVIEW
```

`DECLARED → VERIFIED` is intentionally invalid. Verification requires a defined condition and evidence state.

Information state is separate from truth state:

```text
KNOWN · UNKNOWN · INFERRED · CONFLICTED · STALE · UNAVAILABLE · UNAUTHORIZED_TO_ACCESS
```

Unknown is a valid result. Missing data is never silently converted into a fact.

## Deterministic decision interface

`DeterministicDecision` is serializable and auditable:

```ts
type DeterministicDecision = {
  decision_id: string;
  intent: string;
  inputs: unknown[];
  capability: DeterministicCapability;
  authority: { actor: string; permitted: boolean; reason: string };
  policy: { allowed: boolean; reason: string };
  evidence: { state: InformationState; sources: string[] };
  decision: "ALLOW" | "DENY" | "REQUIRE_HUMAN_CONFIRMATION" | "UNKNOWN";
  confidence: number;
  reason: string;
  constraints: ResourceLimits;
  next_action: string;
  verification_required: boolean;
  human_confirmation_required: boolean;
  timestamp: string;
  receipt_id: string;
};
```

Capability and authority are separate. A technically available capability does not authorize an actor to invoke it. Consequential operations require explicit human confirmation.

## Bounded reasoning

The deterministic core applies default limits of:

| Limit | Default |
|---|---:|
| Maximum recursion depth | 5 |
| Maximum operation count | 100 |
| Maximum execution time | 2,000 ms |
| Maximum reflection cycles | 5 |
| Maximum context size | 32,000 characters |

Exceeding a limit produces a classified failure and a recovery recommendation. It does not simulate success.

## New interfaces

- `listDeterministicCapabilities()` — enumerates the deterministic capability registry.
- `resolveDeterministicCapability(name)` — returns available/unavailable state with a receipt.
- `routeDeterministic(operation, handler)` — routes a named operation without model invocation.
- `validateInput()` — rejects malformed deterministic inputs.
- `classifyEvidence()` — returns explicit known/unknown/conflicted/stale/unauthorized states.
- `evaluateTransition()` — enforces the truth-state graph.
- `makeDecision()` — produces the canonical decision object.
- `checkResourceLimits()` — enforces recursion, operation, timeout, reflection, and context budgets.
- `classifyFailure()` / `recommendRecovery()` — maps failure conditions to bounded next actions.

## Tests added

`server/deterministic-core.test.ts` covers:

- valid and malformed requests;
- unavailable capability;
- unknown, stale, conflicted, unauthorized, and verified evidence;
- invalid truth-state transitions;
- capability/authority/policy separation;
- human confirmation requirement;
- recursion, operation, timeout, and context limits;
- recovery recommendations;
- deterministic reproducibility apart from receipt identity/time;
- deterministic bus routing without an LLM.

## Evidence report

| Category | Status | Evidence |
|---|---|---|
| Deterministic capability bus | **IMPLEMENTED / VERIFIED** | `deterministic-bus.ts`; focused tests pass. |
| Truth state machine | **IMPLEMENTED / VERIFIED** | `truth-state.ts`; invalid transition tests pass. |
| Unknown-first evidence classification | **IMPLEMENTED / VERIFIED** | `classifyEvidence()` and focused tests. |
| Capability vs authority | **IMPLEMENTED / VERIFIED** | `makeDecision()` and sovereign pipeline tests. |
| Canonical deterministic decision | **IMPLEMENTED / VERIFIED** | Decision structure and reproducibility test. |
| Bounded reasoning | **IMPLEMENTED / VERIFIED** | Resource-limit tests for recursion, operations, timeout, and context. |
| Failure/recovery classification | **IMPLEMENTED / VERIFIED** | Failure and recommendation tests. |
| Local model independence | **IMPLEMENTED / VERIFIED** | Core modules have no local-model invocation dependency; deterministic tests run offline. |
| Durable decision/receipt persistence | **PARTIAL** | Receipts are generated and returned; database durability remains a later stage. |
| Schema validation beyond structural input checks | **PARTIAL** | Structural validation is implemented; domain schemas remain capability-specific work. |
| Live local backend compatibility | **UNVERIFIED** | Requires provisioned Ollama, llama.cpp, or vLLM runtime. |
| External-node interoperability | **BLOCKED / NOT AUTHORIZED** | No endpoint contracts or authority supplied; no live integration is claimed. |
