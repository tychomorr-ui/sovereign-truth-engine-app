# KEIRA Stage 7 — APEX CANONICAL Orchestration

## Role separation

KEIRA remains the intelligence runtime. APEX CANONICAL is the orchestration and policy-resolution layer. APEX does not become a model, does not replace KEIRA reflection, and does not invent connectivity to ROOT, ARCHANGEL, VAL, UniversalTruth, Project Reclaim, or MonarchOS.

Unavailable integrations are represented as unavailable capability states. In this release, deterministic and configured local-model execution are available through existing KEIRA buses; trusted mesh and external providers remain explicitly unavailable or disabled according to runtime status.

## Canonical pipeline

```text
INTENT
→ CONTEXT
→ CAPABILITY DISCOVERY
→ AUTHORIZATION
→ POLICY
→ PLAN
→ EXECUTION
→ REFLECTION
→ VERIFICATION
→ RECEIPT
```

`runApexCanonical()` emits a timestamped trace for every stage. It either completes with a result and linked receipt or returns a typed blocked/failed state. A generic success response is never substituted for a failed subsystem.

## ATMOS computational radius

Capability choice uses the smallest safe radius. The order is `LOCAL → EDGE → MESH → FEDERATION → CLOUD`. With no explicit escalation request, APEX selects a local capability only. It does not escalate merely because a remote capability exists. External providers are disabled in the sovereign runtime, and trusted mesh is unavailable unless factual runtime discovery reports otherwise.

Each discovered capability reports its state, radius, locality, network requirement, external-provider requirement, and authorization requirement. Requested unavailable capabilities return `CAPABILITY_UNAVAILABLE` or `MODEL_UNAVAILABLE` without fallback to a larger radius.

## Authority and ROOT concepts

The request carries identity, authority, consent, delegation, and revocation state. Authentication is not treated as authority. A capability requiring consent is blocked unless explicit consent is present. Consequential work also requires explicit human confirmation. Revoked or absent authority is denied before execution.

This is an internal authority contract only. No connectivity to ROOT or another ecosystem node is claimed by this milestone.

## Policy and plan

Policy evaluates data locality, execution, privacy, network, tool, model, human confirmation, and resource limits. The explicit plan contains goal, ordered steps, selected capability, computational radius, authority, constraints, expected outputs, verification requirements, rollback behavior, and human-confirmation state.

Execution is delegated only to the selected approved capability. No arbitrary tool execution is exposed. Deterministic and local-model execution use the existing KEIRA sovereign bus. Provider failures propagate as `PROVIDER_FAILURE`.

## Reflection and verification

APEX delegates critique and bounded revision to KEIRA’s Stage 5 reflection engine. A local model remains generated inference; reflection cannot certify it as truth. Verification checks the execution result, non-empty output, selected capability, plan goal, and receipt completeness. Empty outputs and incomplete receipts produce `VERIFICATION_FAILED`.

## Typed failures

The pipeline propagates `AUTHORITY_REQUIRED`, `POLICY_DENIED`, `CAPABILITY_UNAVAILABLE`, `MODEL_UNAVAILABLE`, `EVIDENCE_INSUFFICIENT`, `VERIFICATION_FAILED`, `HUMAN_CONFIRMATION_REQUIRED`, `NETWORK_UNAVAILABLE`, `PROVIDER_FAILURE`, and `RESOURCE_LIMIT`.

## Receipt linkage

The final receipt links the intent and declared context with execution and reflection receipt IDs. The returned trace links the plan, authority, selected capability, execution state, reflection state, verification state, and final result. Portal persists the final receipt through the existing owner-scoped durable receipt path.

## Demonstrated workflow

The acceptance suite demonstrates:

```text
operator intent
→ local capability discovery
→ explicit operator authority and consent
→ local-only policy
→ deterministic or declared local-model execution
→ KEIRA bounded reflection
→ output and receipt verification
→ complete receipt and trace
```

It also demonstrates unavailable local models, disabled providers, missing authority, missing consent, consequential confirmation requirements, policy denial, offline network denial for mesh, provider failure, verification failure, and receipt generation.

## Actual implementation status

| Area | Status |
|---|---|
| Canonical APEX pipeline | **IMPLEMENTED / VERIFIED** |
| Capability discovery | **IMPLEMENTED / VERIFIED** |
| ATMOS smallest-radius selection | **IMPLEMENTED / VERIFIED** |
| Authority, consent, delegation, revocation contract | **IMPLEMENTED / VERIFIED** |
| Policy evaluation and explicit plans | **IMPLEMENTED / VERIFIED** |
| Approved deterministic/local execution | **IMPLEMENTED / VERIFIED** |
| KEIRA reflection delegation | **IMPLEMENTED / VERIFIED** |
| Verification and typed failures | **IMPLEMENTED / VERIFIED** |
| Linked receipt trace | **IMPLEMENTED / VERIFIED** |
| ROOT/ARCHANGEL/VAL/UniversalTruth connectivity | **UNAVAILABLE / NOT CLAIMED** |
| Live mesh/federation/cloud escalation | **NOT IMPLEMENTED** |
| APEX UI | **NOT IMPLEMENTED** |

## Known limitations

The current APEX execution adapter is provider-neutral and local-first, but it does not implement live EDGE, MESH, FEDERATION, or CLOUD transports. Authority is passed explicitly by the caller and is not yet backed by a durable delegation/revocation registry. The final receipt is persisted by Portal, while the in-memory trace and plan are returned with the request result rather than stored in a separate orchestration table.
