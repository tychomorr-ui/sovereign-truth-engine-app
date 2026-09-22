# KEIRA Legacy Release — Architecture Map and Gap Analysis

**Scope:** First implementation milestone of the KEIRA Legacy Release. This document translates the sovereign-runtime directive into the current codebase, identifies verified gaps, and records the safe implementation sequence.

## A. Current architecture map

```text
React PortalChat UI
  └─ tRPC client
      └─ protected portal.chat router
          ├─ first-party auth/session boundary
          ├─ conversation + context-ledger persistence
          ├─ cMAP mission-state integration
          ├─ context retrieval + response controls
          ├─ strategy selection
          ├─ adaptive response contract
          │   └─ Sovereign Intelligence Bus
          │       ├─ deterministic responder
          │       └─ local OpenAI-compatible model adapter
          ├─ runtime discovery / capability status
          └─ provenance receipt returned in response metadata

Cross-cutting local runtime modules
  ├─ deterministic-engine.ts
  ├─ sovereign-pipeline.ts
  ├─ reflection-engine.ts
  ├─ sovereign-memory.ts
  ├─ runtime-discovery.ts
  └─ sovereign-bus.ts

Persistence
  ├─ MySQL-compatible Drizzle schema
  ├─ portal conversations/messages
  ├─ context ledger
  ├─ learning memory
  └─ current in-memory cMAP mission map (durability gap)
```

**Definition:** KEIRA is the runtime composed of deterministic intelligence, optional local inference, context, memory, reflection, adaptation controls, tools, identity, authority, policy, evidence, provenance, verification, receipts, and recovery. No individual model is KEIRA.

## B. Gap analysis

| Area | Current state | Evidence | Gap |
|---|---|---|---|
| Deterministic intelligence | Implemented | `server/deterministic-engine.ts` and tests | Expand structured transforms and confidence semantics. |
| Local model abstraction | Implemented | `server/local-gateway.ts`, runtime discovery, tests | Live Ollama/llama.cpp/vLLM probes remain unverified until provisioned. |
| Capability resolver | Implemented | `server/sovereign-bus.ts` | Capability registry should become data-driven and versioned. |
| Capability vs authority | **Milestone implemented** | `server/sovereign-pipeline.ts`, fail-closed tests | Wire the pipeline into consequential tool execution when tools are added. |
| Request lifecycle | **Milestone implemented** | Explicit ten-stage trace and receipt | Chat generation still uses a higher-level orchestration path; converge it on this trace incrementally. |
| Memory classification | Partially implemented | `server/sovereign-memory.ts`, existing context ledger | Memory abstraction is process-local; durable memory schema and export/delete endpoints are pending. |
| Provenance | Partially implemented | Operation receipts returned in chat metadata | Receipts are not yet durably stored for every historical operation. |
| Verification | Partially implemented | Deterministic receipts and runtime state | Add evidence objects and claim-state transitions. |
| Reflection | Implemented, bounded | `server/reflection-engine.ts` and recursion tests | Add loop detection, resource budget, and timeout to multi-step workflows. |
| Adaptation | Not implemented as a ledger | Existing profile controls are persisted | Add proposed-change, authorization, result, and rollback records. |
| Recovery | Partially implemented | Deterministic fallback on local-model failure | Add explicit recovery state machine and restart/replay evidence. |
| Local tools | Reserved, not executable | Capability state `AVAILABLE`; adapter rejects tool execution | Add allow-listed tool registry only after authority/policy model is durable. |
| NEXINUS interoperability | Conceptual boundary only | Provider-neutral contracts and documentation | Define versioned adapters for ROOT, APEX, ARCHANGEL, VAL, UniversalTruth, and ATMOS; do not invent live connectivity. |
| Offline operation | Implemented for deterministic path | Offline tests and status panel | Add offline persistence and receipt export/replay. |

## C. Dependency graph

```text
portal-chat-router
  → portal-adaptive-response
      → sovereign-bus
          → local-gateway → _core/env
          → deterministic fallback
  → portal-context-retrieval → db/schema
  → cmap handshake/integration
  → runtime-discovery → sovereign-bus

sovereign-pipeline
  → sovereign-bus (capability resolution + receipts)
  → caller-provided execution boundary

reflection-engine
  → sovereign-bus (receipts)

deterministic-engine
  → sovereign-bus (receipts)

sovereign-memory
  → sovereign-bus (receipts)
```

The dependency direction is intentionally one-way: application orchestration may call the bus; the bus does not know about Portal UI, NEXINUS services, or a specific model vendor.

## D. Implementation sequence

1. **Lifecycle and authority gate — implemented in this milestone.** Add explicit pipeline stages, default-deny authority behavior, policy denial, and human confirmation for consequential operations.
2. **Receipt contract hardening.** Add intent, actor, authority, capability, execution state, inputs, errors, and rollback fields while preserving backward compatibility.
3. **Durable provenance.** Add a database-backed receipt table with redaction and retention policies.
4. **Durable memory.** Add typed memory records, evidence states, revocation, export, deletion, and user authorization.
5. **Tool registry.** Add allow-listed local tools with schemas, capability declarations, authority requirements, policy checks, timeouts, and receipts.
6. **Recovery state machine.** Add retry budgets, replay-safe operations, failure escalation, and recovery receipts.
7. **NEXINUS adapters.** Add versioned, disabled-by-default interfaces; only activate after endpoint contracts and authorization are supplied.
8. **Runtime-specific probes.** Provision and test Ollama, llama.cpp, and vLLM separately; record measured model, endpoint, latency, token usage, and failure states.

## E. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Capability mistaken for authority | Unauthorized action | Explicit pipeline authority stage; default deny; human confirmation gate. |
| Model output treated as truth | False claims | Receipts, evidence states, uncertainty, and model/non-model distinction. |
| In-memory mission state loss | Context drift after restart | Durable cMAP state migration before multi-node use. |
| Receipt leakage | Secret or private context exposure | Redaction, minimal inputs, retention, access control. |
| Recursive runaway | Resource exhaustion | Hard depth, timeout, loop detection, and resource budgets. |
| Local endpoint compromise | Data exfiltration | Loopback/default-local binding, explicit endpoint configuration, no silent remote fallback. |
| Mesh integration overreach | Cross-node authority confusion | Versioned adapters, disabled-by-default connectors, per-node authority contracts. |
| Historical documentation drift | Incorrect deployment | Superseded/deprecated labels and provider dependency audit. |

## F. Test strategy

Every new subsystem requires unit tests for nominal, unavailable, denied, degraded, and recovery states. Integration tests must verify authenticated ownership and that no provider is silently invoked. Property-style tests should cover bounded recursion and receipt invariants. Runtime probes must be run against each supported local backend independently. Release gates remain `pnpm check`, `pnpm test`, `pnpm build`, `bash -n deploy-lightsail.sh`, source audit, and diff audit.

## G. Proposed data schemas

### Canonical receipt (next durable version)

```ts
type KeiraReceipt = {
  receipt_id: string;
  timestamp: string;
  operation: string;
  intent: string | null;
  actor: string | null;
  authority: "operator" | "system" | "delegated" | "none";
  capability: string | null;
  policy: string;
  execution_state: "planned" | "executed" | "blocked" | "failed" | "verified";
  inference_type: "deterministic" | "local_model" | "local_tool" | "trusted_mesh" | "external";
  model: string | null;
  provider: string | null;
  inputs: string[];
  provenance: string[];
  verification: string;
  external_services_used: boolean;
  data_left_local_node: boolean;
  result_state: string;
  errors: string[];
  rollback_state: "not_applicable" | "available" | "requested" | "completed" | "failed";
};
```

### Durable memory

```ts
type MemoryRecord = {
  id: string;
  userId: number;
  class: "working" | "session" | "durable" | "preference" | "system" | "operational" | "evidence" | "provenance" | "adaptive" | "revoked";
  content: string;
  source: string;
  authority: string;
  status: "declared" | "observed" | "documented" | "verified" | "authorized" | "revoked";
  confidence: number | null;
  retention: "turn" | "session" | "until_revoked" | "system";
  createdAt: Date;
  revokedAt: Date | null;
};
```

## H. Proposed interfaces

```ts
interface CapabilityResolver {
  discover(request: SovereignRequest): CapabilityResolution;
}

interface AuthorityPolicy {
  authorize(request: SovereignRequest, capability: CapabilityResolution): PolicyDecision;
}

interface LocalInferenceProvider {
  discover(): Promise<RuntimeDiscovery>;
  generate(request: LocalInferenceRequest): Promise<LocalInferenceResult>;
}

interface ToolRegistry {
  list(): ToolDescriptor[];
  execute(name: string, input: unknown, authorization: AuthorizationContext): Promise<ToolResult>;
}

interface NEXINUSAdapter {
  name: "ROOT" | "APEX_CANONICAL" | "ARCHANGEL" | "VAL" | "UniversalTruth" | "ATMOS";
  status(): AdapterStatus;
}
```

All interfaces are contracts, not claims that corresponding external nodes are online.

## I. Migration strategy

Use additive changes first. Preserve `portal.chat.*` tRPC contracts and current conversation tables. Introduce receipt and memory tables with nullable/backfillable fields. Emit receipts in memory before durable persistence. Add feature flags for durable receipt writes and tool execution. Backfill only explicit operator-owned context; do not promote historical dialogue to verified durable memory automatically. Keep external adapters disabled until authenticated, versioned, and tested.

## J. First implementation milestone

**Implemented:** `server/sovereign-pipeline.ts` now models `INTENT → CONTEXT → CAPABILITY_DISCOVERY → AUTHORIZATION → POLICY → PLAN → EXECUTION → REFLECTION → VERIFICATION → RECEIPT`. It distinguishes technical capability from authority, denies missing authority, denies policy failures, requires human confirmation for consequential operations, delegates execution through an explicit callback, and returns a trace plus receipt. Four acceptance tests cover successful ordering, authority denial, confirmation denial, and policy denial.

**Verified:** The milestone is covered by `server/sovereign-pipeline.test.ts`. Full project verification remains the release gate after this change.

**Partially implemented:** Durable receipts, durable structured memory, tool execution, recovery state machines, and NEXINUS adapters remain subsequent milestones.

**Unverified:** Live local runtime compatibility for Ollama, llama.cpp, and vLLM until each is provisioned and probed.

**Blocked by missing authority/configuration:** Any real external-node integration or consequential tool execution.
