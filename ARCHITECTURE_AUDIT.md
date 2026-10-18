# KEIRA Architecture Audit

**Audit phase:** Step 0 inspection with Phase 2 corpus-foundation addendum
**Repository:** `sovereign-truth-engine-app`  
**Commit audited:** `332f289` — temporary beta-open mode  
**Audit date:** 2026-10-18  
**Scope:** Existing implementation versus the attached KEIRA Master Build Directive and execution addendums.

## Executive conclusion

KEIRA is an existing React/Vite + Express/tRPC + Drizzle/MySQL application whose active product surface is Portal Chat. It already contains a substantial local-first deterministic runtime: deterministic primitives, APEX CANONICAL orchestration, a sovereign capability bus, bounded reflection, provenance-aware memory abstractions, adaptive proposal controls, offline/degradation simulation, durable receipts, and an optional OpenAI-compatible local inference adapter supporting Ollama, llama.cpp, and vLLM-style endpoints.

The attached MIST/Phoenix directive is **not implemented as a complete system**. Phase 2 now provides deterministic Markdown/TXT ingestion, token-aware chunking, SHA-256 content IDs, and browser-local IndexedDB storage behind a `CorpusStore` interface. It deliberately does not provide PDF parsing, a corpus UI, local embeddings, seven-layer MIST retrieval, trajectory attestation, structured claim verification, Phoenix retry loops, or XINUS Meta-Bus/SSO integration. Existing Ed25519 functionality is KEIRA's application identity receipt, not trajectory signing.

The current application remains operational without a model through a transparent deterministic response path. The hosted project is currently in temporary beta-open mode: unauthenticated requests receive a dedicated non-owner beta user. This is a deliberate test configuration and must not be treated as production authentication.

## Existing runtime architecture

```text
Browser / React 19 / Vite / Tailwind 4
        │
        │ tRPC client over /api/trpc
        ▼
Express 5 server
  ├─ security headers
  ├─ public health and .well-known identity routes
  ├─ tRPC context: session auth or temporary beta user
  ├─ publicProcedure / protectedProcedure / adminProcedure
  └─ Vite middleware in development or dist/public in production
        │
        ├─ auth and sovereign session procedures
        ├─ Portal Chat router
        ├─ APEX CANONICAL
        ├─ governed local intelligence
        ├─ deterministic engine and sovereign bus
        ├─ local model adapter
        ├─ bounded reflection
        ├─ memory and receipt persistence
        └─ offline resilience controller
        │
        ▼
Drizzle ORM → MySQL/TiDB-compatible database
```

## Frontend

- `client/src/App.tsx` registers `/` and `/portal-chat` to `PortalChat` and `/404` to `NotFound`.
- `client/src/pages/PortalChat.tsx` is the active UI. It includes conversation UI, cMAP-related session presentation, context ledger, recall, profile/personalization controls, voice controls, capability/status panels, exports, and response metadata presentation.
- The page obtains the current user through `client/src/_core/hooks/useAuth.ts`, then enables protected tRPC queries and mutations.
- The page previously rendered an owner-entry screen when unauthenticated. The current hosted environment has `BETA_OPEN_MODE=true`, so the server supplies a non-owner beta session and the Portal surface loads without credentials.
- `client/src/lib/trpc.ts` is a typed tRPC React binding; no separate REST client or WebSocket client was found.
- Styling is Tailwind 4 plus existing CSS/component primitives. The UI is a bespoke dark, cinematic console rather than the directive's proposed new file tree.

## Backend and API

- `server/_core/index.ts` creates the Express server, applies security headers, parses JSON/urlencoded bodies, registers public REST-style health/identity endpoints, mounts `/api/trpc`, and selects Vite development middleware or static production serving.
- `server/routers.ts` composes auth procedures and `portalChatRouter`. Legacy/unused routers are intentionally not mounted in the active app router.
- `server/_core/context.ts` authenticates requests through the sovereign SDK. When `BETA_OPEN_MODE=true` and no authenticated user exists, it obtains or creates the dedicated `beta@keira.local` non-owner user. Protected procedures still require `ctx.user`; they do not become public in the general case.
- `server/_core/trpc.ts` defines `publicProcedure`, `protectedProcedure`, and `adminProcedure`. Admin access remains role-based (`role === 'admin'`).
- The primary API contract is tRPC under `/api/trpc`. Explicit non-tRPC routes currently include `/api/beta-status`, `/api/keira-identity/health`, `/.well-known/keira-identity.json`, and `/.well-known/keira-receipt.json`.
- No SSE, WebSocket, event-stream, or browser-to-Ollama transport was found.

## Deterministic systems already present

| System | Location | Actual status |
|---|---|---|
| Deterministic primitives | `server/deterministic-engine.ts` | Implemented and tested; normalization, classification, contradiction, planning, policy/state primitives |
| Sovereign bus | `server/sovereign-bus.ts` | Implemented capability resolution, receipt creation, local/external boundaries |
| APEX CANONICAL | `server/apex-canonical.ts` | Implemented ten-stage orchestration with explicit authority, policy, plan, execution, reflection, verification, receipt |
| Governed generation | `server/governed-local-intelligence.ts` | Implemented as a transformation/inference lane with evidence adjudication boundaries |
| Local inference adapter | `server/local-model.ts`, `server/local-gateway.ts` | Implemented optional OpenAI-compatible local endpoint; JSON Schema and llama.cpp GBNF support exists |
| Reflection | `server/reflection-engine.ts` | Implemented deterministic bounded reflection with depth/time/operation/token limits and loop/contradiction handling |
| Memory fabric | `server/memory-fabric.ts`, `server/keira-durable-memory.ts` | Implemented metadata, authority/provenance checks, revocation, conflict detection, context assembly, durable database APIs |
| Adaptive controls | `server/adaptation-engine.ts`, `server/adaptation-persistence.ts` | Implemented proposal-first allow-list, authorization, shadow mode, rollback, protected variables |
| Offline resilience | `server/offline-resilience.ts` | Implemented in-process state/queue/recovery model and snapshot/restore; durable database-backed queue is not implemented |
| Receipts | `server/intelligence-receipts.ts`, `server/sovereign-bus.ts` | Implemented operation receipts; durable receipt persistence exists for selected operations |
| KEIRA identity | `server/keira-identity.ts`, `server/keira-identity-persistence.ts` | Implemented server-side Ed25519 identity receipt and encrypted private-key persistence; separate from MIST trajectory attestation |

## Existing persistence

The schema is MySQL-oriented Drizzle schema in `drizzle/schema.ts`. It includes users, Portal conversations/messages, learning memory, context ledger, durable KEIRA memory, intelligence receipts, adaptation records, and KEIRA identity keys/receipts. Migrations are additive SQL files under `drizzle/` with Drizzle metadata under `drizzle/meta/`.

The current resilience queue is held in a process-local `Map` and serialized only through explicit snapshots. It is not a durable queue table. cMAP mission state is also explicitly in-memory per conversation in `portal-chat-router.ts`.

## Authentication and beta boundary

Normal paths include sovereign email/password credentials, owner bootstrap token, session cookie handling, and role-based admin procedures. The active hosted beta configuration enables `BETA_OPEN_MODE`, which creates a non-owner account for anonymous visitors. This permits testing but creates a public-access posture and must be disabled before production use.

The beta user is not an owner and cannot call `adminProcedure` routes. Nevertheless, all protected Portal data associated with the singleton beta account is shared by visitors using that beta identity; this is a test isolation limitation that should be resolved before multi-user beta access.

## Local LLM boundary

The local model adapter uses standard `fetch` against a configured endpoint ending in `/v1`, then calls `/chat/completions` and `/models`. Environment configuration is server-side through `server/_core/env.ts`. The active implementation supports runtime labels for Ollama, llama.cpp, vLLM, and generic local OpenAI-compatible endpoints. External AI providers are disabled in the sovereign routing layer.

If no local endpoint/model is configured, the local gateway returns a deterministic response. A configured endpoint failure is surfaced as a local-model failure through the provider path; the application must not be described as having live local inference until an actual endpoint is reachable.

## Cryptography and provenance

KEIRA identity signing is server-side. The private Ed25519 key is encrypted at rest using `KEIRA_IDENTITY_ROOT_SECRET` and is not exposed through public routes. Public identity/receipt endpoints expose only public material and signed receipt data. This identity receipt is not a MIST trajectory root, not a corpus attestation, and not an SSO/mesh signature.

Operation receipts include policy, verification, locality, provider/model, context sources, and result state. The audit found no cryptographic hash-chain over all ordinary operation receipts and no Merkle tree over retrieved artifacts.

## Directive-to-repository gap summary

| Directive area | Current state |
|---|---|
| Preserve deterministic engine | Existing and tested |
| Local Ollama-compatible inference | Adapter exists; live endpoint unverified in this environment |
| MIST L1–L7 retrieval | Not implemented as specified |
| Corpus upload/parse/chunk/hash/index | Partially implemented: Markdown/TXT module ingestion, token-aware chunks, hashes/CIDs, and IndexedDB store; no upload UI, PDF parser, or retrieval index |
| Local embeddings (`Xenova/all-MiniLM-L6-v2`) | Not installed or implemented |
| IndexedDB corpus persistence | Implemented adapter and API-contract tests; browser quota/eviction and UI acceptance remain unverified |
| LanceDB-compatible abstraction | Not implemented |
| Trajectory object and 30-artifact fusion | Not implemented |
| Merkle trajectory attestation | Not implemented |
| Trajectory Ed25519 signing | Not implemented; identity receipt is separate |
| Structured claim extraction/verifier | Not implemented as the required MIST-bound contract |
| Phoenix maximum-three-pass recursion | Existing bounded reflection is not Phoenix and lacks corpus claim retry semantics |
| Echoes/Patterns/Arcana/Trajectory UI | Existing visual labels/cards exist, but not backed by MIST layer outputs |
| Corpus UI | Not implemented |
| Operator LLM settings UI | Existing profile controls exist; required endpoint/model settings surface is not confirmed as implemented |
| SSO / Meta-Bus / mesh integration | Not implemented; trusted mesh is explicitly not configured |
| CORS allowlist | No explicit CORS middleware/allowlist found in the active server entrypoint |
| Reverse proxy compatibility | Basic proxy trust and host/port behavior exist; Nginx/Caddy/TLS/Ollama path not live-verified here |
| Acceptance suite | 201 tests passed with 1 expected RDS skip after Phase 2; MIST/Phoenix acceptance tests remain unimplemented |

## Audit decision

The least destructive next step is a **Phase 3 browser-local embedding compatibility proof**, not broad MIST implementation. Do not replace Portal Chat, APEX, the deterministic baseline, or the existing local gateway.
