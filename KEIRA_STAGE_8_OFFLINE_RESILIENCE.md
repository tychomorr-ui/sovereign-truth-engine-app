# KEIRA Stage 8 — Offline Resilience, Degradation, and Recovery

## Scope and evidence standard

Stage 8 demonstrates controlled behavior under simulated failure conditions. It does not call KEIRA resilient merely because fallback code exists. The test suite drives network, provider, model, database, mesh, tool, authority, policy, input, and evidence failures through explicit states and checks recovery behavior.

## Explicit states

The controller exposes `FULL`, `DEGRADED`, `OFFLINE`, `RECOVERY`, and `BLOCKED`.

`OFFLINE` means network-dependent capability is unavailable while local deterministic intelligence, local memory, local policies, provenance, receipts, and verification remain usable. `DEGRADED` means a subsystem is unavailable but some capability remains. `BLOCKED` means the requested operation cannot safely proceed. `RECOVERY` is a controlled validation window, not permission to replay work blindly.

## Degradation matrix

| Failure | Affected capability | Remaining capability | Expected behavior | Recovery method |
|---|---|---|---|---|
| No internet | Network, mesh, external providers | Deterministic, local memory, policy, receipts | Enter `OFFLINE`; no remote-data simulation | Recheck network, then controlled recovery |
| Local model offline | Local model | Deterministic runtime | Explicit model unavailability or permitted deterministic fallback | Health-check configured runtime |
| Ollama failure | Ollama adapter | Other local adapters and deterministic runtime | Mark adapter unavailable | Bounded health retry |
| llama.cpp failure | llama.cpp adapter | Other local adapters and deterministic runtime | Mark adapter unavailable | Operator-controlled restart |
| vLLM failure | vLLM adapter | Other local adapters and deterministic runtime | Mark adapter unavailable | Health-check and controlled restart |
| External provider failure | External provider | Local capabilities | No silent escalation or fake success | Health-check and reauthorization |
| Database interruption | Durable reads/writes | Bounded in-memory operation | Do not claim durable success | Reconnect and schema verification |
| Mesh unavailable | Trusted mesh | Local capabilities | Remain local/offline | Mesh health check |
| Tool unavailable | Requested tool | Deterministic reasoning and available tools | Explicit tool unavailability | Tool health check |
| Insufficient authority | Authorized execution | Read-only inspection | `BLOCKED`; do not queue | Fresh explicit authority |
| Policy denial | Denied operation | Policy-compliant operations | `BLOCKED`; no blind retry | Policy review |
| Invalid input | Requested operation | None for malformed request | `BLOCKED` | Correct input |
| Conflicting evidence | Verification | Local inspection and human review | Block or require confirmation | Resolve conflict |

## Offline queue

Authorized, non-expired work can be queued with an idempotency key, intent, authority, policy, required capability, creation time, expiry, retry policy, consequential flag, and receipt ID. Queueing fails for missing authority, denied policy, malformed intent, or expired work. Unavailable authority and policy are not converted into queued work.

The queue is conservative. Recovery validates that authority remains valid, policy remains valid, data remains valid, the item has not expired, the item is still queued, and the idempotency key has not already completed or been revoked. Expired and revoked work is not replayed.

## Duplicate protection and restart

Completed idempotency keys are retained in the controller state and block subsequent execution. A serializable snapshot/restore path demonstrates queue and receipt continuity across a simulated restart. The current milestone proves restart continuity in the controller; it does not claim durable database-backed queue storage yet.

## Recovery architecture

```text
failure detected
  → explicit degraded state
  → preserve local receipts and queued state
  → infrastructure returns
  → RECOVERY state
  → revalidate authority, policy, data, expiry, completion, and side-effect uniqueness
  → execute at most once when valid
  → COMPLETED / BLOCKED receipt
  → FULL only after controlled recovery completes
```

A failed execution increments attempts and stops at the configured retry limit. Recovery cannot bypass APEX authority, policy, or capability gates.

## Test evidence

The Stage 8 tests cover all declared failure classes through matrix/state assertions; offline continuation; authority and policy rejection; expiry; revocation; duplicate queue protection; successful recovery; duplicate side-effect prevention; restart snapshot continuity; changed authority/data blocking; recovery state transitions; APEX integration; and existing sovereign runtime regressions.

The measured test run records 19 focused tests passing. The full release gate is the authoritative result for the complete repository and will be recorded at checkpoint time. Since the controlled tests execute in-process, measured degradation and recovery times are bounded by the test call itself rather than production network latency. No lost operation or duplicate side effect occurred in the recovery tests.

## Failure evidence and limitations

The tests simulate failures; they do not disable the host network, kill a production database, or terminate a real Ollama, llama.cpp, or vLLM process. Those external failure drills remain future operational tests. Queue state is currently controller-local with snapshot/restore, not a durable database table. A future milestone should persist queue items and completed idempotency keys, add authenticated live restart tests, and connect health checks to each installed local runtime.
