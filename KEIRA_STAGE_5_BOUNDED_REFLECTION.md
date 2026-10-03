# KEIRA Stage 5 — Bounded Recursive Reflection

## Definition

Reflection is a bounded inspection process:

```text
observe current state
→ evaluate
→ identify deficiency
→ revise
→ re-evaluate
→ terminate
```

This implementation is **not consciousness, sentience, self-awareness, supernatural cognition, or independent agency**. It is deterministic validation and revision logic around a request/result pair.

## Architecture

`runBoundedReflection()` executes the following lifecycle:

```text
INTENT → PLAN/INITIAL RESULT → EXECUTE/GENERATE → INSPECT → CRITIQUE → REVISE → VERIFY → COMPLETE
```

The current Stage 5 implementation performs deterministic critique first. It checks:

- missing intent;
- evidence availability for source/verification requests;
- unsupported certainty language;
- unauthorized-information flags;
- contradictory evidence patterns;
- output token budget;
- policy and human-confirmation state.

A local model is not used as a truth certifier. If a local model produces the initial result, that result remains generated inference. Reflection may revise wording or escalate; it cannot promote inference to verified fact.

Portal adaptive responses now pass the generated local result through a bounded reflection pass. An accepted revision is returned; human-review or failure states preserve the original generated result and expose the reflection state in response metadata.

## Reflection object

Each iteration records:

- `reflection_id`;
- `parent_operation`;
- `iteration`;
- observations;
- identified issues;
- severity;
- proposed revision;
- evidence;
- policy state;
- decision;
- termination reason;
- receipt ID.

The reflection pipeline also returns a receipt-backed final result, iteration count, operation count, elapsed time, evidence state, and final decision.

## Levels

| Level | Behavior |
|---|---|
| `0` | No reflection; return the supplied result. |
| `1` | Basic deterministic validation. |
| `2` | Critique and bounded revision. |
| `3` | Multi-factor validation with policy, evidence, contradiction, and escalation checks. |

Higher reflection is not assumed to be better. It costs time and may correctly escalate ambiguity rather than resolve it.

## Limits

All limits are normalized and policy-bounded:

- `maxReflectionDepth`: 0–10;
- `maxRecursionDepth`: 0–10;
- `maxTimeMs`: 1–60,000;
- `maxOperations`: 1–100;
- `maxTokens`: 32–100,000.

Portal currently uses depth 2, recursion 2, eight operations, 500 ms, and 4,096 tokens for the response pass.

## Loop detection and termination

The engine terminates safely on:

- repeated plans/state keys;
- repeated revised outputs;
- failed revisions;
- recursion depth;
- reflection depth;
- time budget;
- operation budget;
- token budget;
- contradictory evidence;
- policy violations;
- unresolved consequential ambiguity.

Contradictions and unauthorized information produce `HUMAN_CONFIRMATION_REQUIRED`; they do not silently select a winner or fabricate certainty.

## Demonstrated revision

The acceptance test supplies:

```text
Initial output: “This is guaranteed and certainly correct.”
```

The deterministic critique identifies unsupported certainty and revises it to bounded language containing `typically`. The final result is returned only after the revision pass and a clean re-evaluation.

## Verification

Stage 5 tests cover:

- successful reflection;
- single revision;
- multiple bounded passes;
- reflection and recursion limits;
- timeout and operation limits;
- token limits;
- repeated revision loop detection;
- contradiction escalation;
- insufficient evidence;
- policy violation;
- human confirmation;
- successful and failed termination;
- legacy reflection compatibility;
- receipt generation.

## Known limitations

- Semantic critique is deterministic and intentionally conservative; it is not a general truth judge.
- The current local model reflection path records generated output as inference and does not use a second model critic.
- Timeout behavior is cooperative between bounded checkpoints; a synchronous external callback that blocks the JavaScript thread cannot be forcibly interrupted.
- Reflection records are currently returned in response metadata; durable reflection-record storage is a future milestone.
- Human escalation is represented as a state; no operator approval UI or queue is implemented yet.
