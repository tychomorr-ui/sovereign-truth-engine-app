# KEIRA Stage 6 — Controlled Adaptive Intelligence

## Definition

Controlled adaptation changes approved behavioral parameters only through an explicit proposal, evidence review, shadow evaluation, authorization, activation, and rollback path. It is not arbitrary self-modifying code, self-granted authority, credential generation, security-policy bypass, governance change, or hidden behavior.

## Safe adaptive variables

The engine permits routing preference, model selection, tool selection, context selection, retrieval weighting, response strategy, workflow ordering, performance parameters, and user-approved preferences. Protected roots—including security policy, authority, credentials, identity, audit rules, receipt integrity, external-data permissions, and system trust roots—are rejected before proposal creation.

## Proposal lifecycle

```text
learning signals
  → evidence score
  → ADAPTATION_PROPOSAL (PENDING / SHADOW)
  → shadow evaluation
  → explicit operator authorization
  → ACTIVE
  → receipt-backed result
  → ROLLED_BACK when needed
```

Every proposal contains an adaptation ID, current and proposed state, reason, evidence, expected effect, risk, authority, approval, rollback state, result, timestamps, and receipt ID. The database table `keiraAdaptationRecords` persists the proposal and lifecycle history with owner scoping.

## Learning signals and scoring

Accepted signal types are verified outcomes, explicit user feedback, successful tasks, failed tasks, performance metrics, human corrections, and validated evidence. Raw model output is not ground truth. Scoring calculates success rate, failure rate, verified confidence, sample count, recency, and context similarity.

The default activation evidence threshold is at least three relevant samples, at least 70% verified confidence, and a success rate greater than the failure rate. A single event cannot activate an adaptation. Risk is also checked; high-risk adaptations cannot be activated by the standard operator flow.

## Shadow mode and authorization

New proposals begin in `SHADOW`. Shadow evaluation records positive or negative outcomes without changing active behavior. Activation requires an explicit operator authorization object. System-only or denied authorization results in `REJECTED` and an authorization receipt. This milestone intentionally exposes proposal creation and history through protected Portal procedures; the engine remains the authority boundary for activation and rollback.

## Rollback

An active adaptation retains its previous state. Rollback restores that state, changes the mode to `ROLLED_BACK`, records the reason and timestamp, and emits a rollback receipt. Failed shadow outcomes remain shadow outcomes and are never silently promoted.

## Demonstration

The tests demonstrate a harmless routing change:

1. Three independently verified technical outcomes produce a proposal from `route-a` to `route-b`.
2. The proposal remains `SHADOW` and `PENDING`.
3. A positive shadow result is recorded.
4. Explicit operator authorization changes it to `ACTIVE` and emits `adaptation.activate`.
5. A regression reason rolls it back to `route-a` and emits `adaptation.rollback`.

The same suite demonstrates single-sample rejection, failed shadow behavior, denied authorization, high-risk policy protection, and protected-variable rejection.

## Evidence status

| Area | Status |
|---|---|
| Safe adaptive-variable allow-list | **IMPLEMENTED / VERIFIED** |
| Proposal-first lifecycle | **IMPLEMENTED / VERIFIED** |
| Evidence scoring and single-sample rejection | **IMPLEMENTED / VERIFIED** |
| Shadow mode | **IMPLEMENTED / VERIFIED** |
| Explicit operator authorization | **IMPLEMENTED / VERIFIED** |
| Protected policy roots | **IMPLEMENTED / VERIFIED** |
| Reversible activation and rollback | **IMPLEMENTED / VERIFIED** |
| Durable adaptation history | **IMPLEMENTED / VERIFIED** — migration applied |
| Restart persistence | **PARTIAL / NOT CLAIMED** — durable schema exists, but live authenticated restart readback was not executed in this milestone |
| Automatic online activation | **NOT IMPLEMENTED** — deliberately prohibited by default |
| Credential/security-policy adaptation | **BLOCKED BY DESIGN** |

## Known limitations

The current persistence layer records proposals and history but does not yet provide a durable state resolver that reapplies active adaptations after restart. Activation and rollback are deterministic in-process operations; a future milestone should add owner-scoped durable transition procedures and a restart readback test before claiming persistent adaptive behavior.
