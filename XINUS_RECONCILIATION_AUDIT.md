# XINUS / NEXINUS Reconciliation Audit

**Scope:** KEIRA repository only  
**Audited commit:** `0ea056c`  
**Audit date:** 2026-11-02  
**Method:** Static source, test, documentation, and Git inspection. No authenticated production execution was claimed because the hosted account path remained unavailable.

## Executive conclusion

This checkout provides evidence for a local-first KEIRA runtime with deterministic routing, optional server-side local-model access, MIST/corpus retrieval, bounded Boomerang traversal, Merkle commitments, server-side Ed25519 attestation, receipts, and protected user-scoped persistence.

This checkout does **not** provide sufficient evidence that ATMOS, ARCHANGEL, VALKYRIE, Monarch-OS, or a live Pharo-Lapse transport/mesh are integrated or online. References to those systems in documentation or symbolic names are not treated as implementation evidence. The current result is therefore a **KEIRA-local runtime with bounded interoperability references**, not a verified XINUS mesh.

## Evidence rule

Every claim in this report is classified as one of:

- `VERIFIED_FROM_CODE`
- `VERIFIED_FROM_TEST`
- `VERIFIED_FROM_GIT`
- `DOCUMENTED_BUT_UNVERIFIED`
- `ARCHITECTURAL`
- `UNKNOWN`
- `STALE`
- `CONTRADICTED`

A successful HTTP response, a UI label, or a documentation statement is not treated as proof of a node, authority relationship, transport path, or deployment state.

## Shared-spine reconciliation

| System or role | Classification | Evidence in this checkout | Boundary |
|---|---|---|---|
| **KEIRA** | `VERIFIED_FROM_CODE` / `VERIFIED_FROM_TEST` | `server/sovereign-pipeline.ts`, `server/sovereign-bus.ts`, `server/mist-core.ts`, `server/boomerang-telemetry.ts`, identity and receipt modules; full suite passed at the audited commit | Proves KEIRA-local behavior only; not mesh membership |
| **ATMOS** | `UNKNOWN` | No active ATMOS implementation or adapter was found in source scan | Identity/evidence substrate relationship is not established by this repository |
| **ARCHANGEL** | `UNKNOWN` | No active ARCHANGEL adapter, endpoint, signed command contract, or authenticated control-plane exchange was found | No governance authority should be inferred |
| **Pharo-Lapse** | `DOCUMENTED_BUT_UNVERIFIED` for transport; `VERIFIED_FROM_CODE` for local envelope integrity | Local Boomerang modules define `PharoLapseEnvelope`, canonical payload hashing, verification, and bounded traversal | Network delivery, peer registry, replay protection, acknowledgements, and store-and-forward are not demonstrated |
| **Tesseract** | `DOCUMENTED_BUT_UNVERIFIED` / `STALE` as an external runtime | Tesseract names appear in legacy UI/docs and mirror modules | No independent Tesseract endpoint or signed interoperability exchange is proven here |
| **VALKYRIE** | `DOCUMENTED_BUT_UNVERIFIED` | Appears in naming/specification documents | No adjudication API, signed operation contract, or live consumer is present in this checkout |
| **Monarch-OS** | `UNKNOWN` | No implementation or source adapter found | Must be reconciled from its actual repository before making capability claims |
| **Cryptochrometer / Witness** | `UNKNOWN` | No active implementation found under those names | Must not be treated as an authority or verification source |

## What KEIRA actually proves

### Identity and attestation — `VERIFIED_FROM_CODE`, `VERIFIED_FROM_TEST`

KEIRA has server-side Ed25519 identity handling, encrypted private-key persistence, public identity receipts, Merkle-root commitments, and Boomerang result attestation. The current release additionally binds an attestation `keyId` to the derived public key and rejects incomplete or mismatched attestation metadata.

Evidence includes `server/keira-identity.ts`, `server/keira-identity-persistence.ts`, `server/boomerang-persistence.ts`, `server/boomerang-telemetry.ts`, `server/boomerang-telemetry.test.ts`, and `server/boomerang-persistence.test.ts`.

This proves application-level KEIRA provenance. It does not prove ATMOS identity, XINUS membership, or an external trust root.

### Deterministic routing and authority boundaries — `VERIFIED_FROM_CODE`, `VERIFIED_FROM_TEST`

The deterministic pipeline distinguishes intent, context, capability discovery, authorization, policy, planning, execution, reflection, verification, and receipt. Capability is not treated as authority, and consequential operations can require confirmation.

Evidence includes `server/sovereign-pipeline.ts`, `server/keira-routing-core.ts`, `server/auth-state.ts`, and their tests.

No external control-plane authority is implied.

### MIST and corpus retrieval — `VERIFIED_FROM_CODE`, `VERIFIED_FROM_TEST`

Server-side corpus ingestion, 768-dimensional local embedding alignment, similarity ranking, seven-layer MIST retrieval, durable trajectories, Merkle commitments, and protected user scoping are present in the current source and test suite.

The browser-side embedding path was removed. The current production-safe direction is backend retrieval over durable corpus vectors; the browser visualizer consumes server trajectory data.

### Boomerang traversal — `VERIFIED_FROM_CODE`, `VERIFIED_FROM_TEST`

The local Boomerang implementation performs bounded multi-agent traversal, envelope integrity checks, fusion, full-evidence Merkle commitment, telemetry, persistence, and forensic verification. Execution IDs and trajectory IDs are distinct.

This is a local application workflow. It is not evidence of network-level Pharo-Lapse routing.

### Local inference — `VERIFIED_FROM_CODE`; live reachability `UNKNOWN`

The server-side local-model adapter supports configured OpenAI-compatible local endpoints and bounded context/model selection. The browser does not call Ollama directly.

A live endpoint, WireGuard path, model availability, and production latency require an authenticated or server-side runtime probe. They are not established by this repository audit.

### Authentication — `VERIFIED_FROM_CODE`; hosted live login `UNKNOWN`

Normal sovereign registration/login, session cookies, protected procedures, and explicit authentication states are implemented. Beta availability is not equivalent to authentication and does not grant owner/admin authority.

The hosted preview could not be used for live Boomerang validation because the available account path remained logged out and the operator reported that authentication was still broken. No live execution is claimed.

## Claims explicitly not made

This audit does not claim that:

- KEIRA is connected to ATMOS, ARCHANGEL, VALKYRIE, Monarch-OS, or a live XINUS control plane.
- KEIRA can execute arbitrary cross-node commands, SSH, deployment, firewall changes, or credential retrieval.
- Local Pharo-Lapse code constitutes a network transport or store-and-forward mesh.
- A responding URL is a verified node.
- Documentation or naming establishes authority.
- Model output is truth.
- The hosted preview has passed an authenticated live Boomerang execution.

## Required evidence to advance reconciliation

1. The actual ATMOS, ARCHANGEL, VALKYRIE, Monarch-OS, and Pharo-Lapse repositories or canonical endpoint contracts.
2. Public manifests and signatures for each participating node, with independently verifiable key IDs.
3. A bounded, authenticated adapter contract for any control-plane request; no unrestricted shell or credential capability.
4. A reproducible live test showing one signed operation, recipient verification, replay handling, acknowledgement, and receipt across the intended transport.
5. A working KEIRA authentication path before any hosted live execution is treated as evidence.

## Verification status at commit `0ea056c`

- Focused Boomerang attestation tests: **8 passed**.
- Full regression suite: **67 test files passed, 288 tests passed, 1 skipped**.
- TypeScript check: **passed**.
- Drizzle schema check: **passed**.
- Production build: **passed**.
- Git synchronization: **pushed to `main`**.
- Authenticated hosted Boomerang execution: **not verified; blocked by the current login path**.
