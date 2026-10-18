# KEIRA Deterministic Preservation Baseline

**Phase:** 1 — preservation
**Purpose:** Lock the existing deterministic and fail-closed runtime behavior before corpus, MIST, embeddings, trajectory attestation, or Phoenix implementation begins.

## Scope

This baseline does not add a model, corpus store, embedding dependency, database table, API procedure, or UI feature. It provides an explicit regression tripwire around the runtime characteristics that later phases must preserve.

The dedicated cross-module suite is:

```text
server/deterministic-preservation-baseline.test.ts
```

It must stay runnable without a database, network access, configured local model, or external provider.

## Protected invariants

The baseline asserts all of the following.

1. **Deterministic transforms are local and receipt-backed.** Normalization, classification, contradiction detection, bounded plans, policy evaluation, and state comparison retain deterministic outputs and receipts that declare no external service use or data egress.
2. **UNKNOWN is not FALSE.** Missing authorized evidence remains `UNKNOWN`; it is not silently promoted or negated.
3. **Capability is not authority.** An available computational path does not execute when authority is absent.
4. **Authority is not policy.** Authorized requests remain blocked when policy denies the operation.
5. **No external fallback is inferred.** Explicit deterministic conversation requests remain local and receipts report `external_service_used: false` and `data_left_local_node: false`.
6. **Model-style certainty is bounded.** Reflection revises unsupported certainty language and escalates conflicts for human confirmation rather than certifying them.
7. **Inference is not evidence.** Inferred local-model content cannot be stored as evidence; conflicting memory remains visible as a human-review requirement.
8. **Offline work is controlled.** Offline state does not fabricate remote success. Recovery requires valid authority, policy, and data; completed work cannot execute twice.

## Existing tests retained as the broader preservation surface

| Area | Existing tests |
|---|---|
| Deterministic decisions, evidence state, resource limits | `server/deterministic-core.test.ts` |
| Ten-stage orchestration and typed failure | `server/apex-canonical.test.ts` |
| Authority/policy lifecycle | `server/sovereign-pipeline.test.ts` |
| Local model protocol and constrained decoding | `server/local-model.test.ts` |
| Governed generation/claim adjudication | `server/governed-local-intelligence.test.ts` |
| Reflection limits, loops, contradictions | `server/reflection-engine.test.ts` |
| Memory provenance, revocation, conflicts | `server/memory-fabric.test.ts`, `server/keira-durable-memory.test.ts` |
| Offline state, queue, recovery/idempotency | `server/offline-resilience.test.ts` |
| Adaptive controls | `server/adaptation-engine.test.ts` |
| Adversarial integrity | `server/adversarial-integrity.test.ts` |
| Identity receipt security | `server/keira-identity.test.ts`, `server/keira-identity-health.test.ts` |
| End-to-end runtime integration | `server/final-integration-validation.test.ts`, `server/sovereign-runtime.test.ts` |

## Required validation commands

Run these before merging any future local-intelligence feature:

```bash
pnpm vitest run server/deterministic-preservation-baseline.test.ts
pnpm test
pnpm check
pnpm build
git diff --check
```

A later feature may add behavior, but it must not weaken these assertions, reclassify generated inference as fact, enable a remote provider fallback, or make deterministic operation depend on a local model.

## Explicit non-goals

This baseline does not prove:

- a live Ollama/llama.cpp/vLLM endpoint is reachable;
- MIST retrieval, embeddings, or corpus persistence works;
- a Merkle trajectory or trajectory signature exists;
- Phoenix claim recursion works;
- a durable database-backed offline queue exists;
- an external mesh, CORS allowlist, Nginx/Caddy proxy chain, or cross-origin client is configured.

Those capabilities remain future phases and must be validated independently.
