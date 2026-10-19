# KEIRA File Impact Matrix

**Audit phase:** Step 0 — no implementation authorized  
**Audited commit:** `332f289`  
**Rule:** This matrix identifies likely impact only. It does not authorize modification of any listed file.

## Existing files and preservation status

| File/directory | Current role | Directive relationship | Step 0 disposition | Future risk |
|---|---|---|---|---|
| `client/src/App.tsx` | Active route registration and theme/provider shell | Existing UI boundary | Preserve | High: route rewrites could break Portal |
| `client/src/pages/PortalChat.tsx` | Active Portal Chat UI and protected-query orchestration | UI must be preserved; new panels should be additive | Preserve | High: large 1,100+ line surface and many query dependencies |
| `client/src/_core/hooks/useAuth.ts` | Auth/session query hook | Beta and normal auth boundary | Preserve | High: changing semantics can recreate login loops or leak session assumptions |
| `client/src/lib/trpc.ts` | Typed API client | All new server contracts should use this pattern | Preserve | Medium |
| `client/src/index.css`, `client/src/components/*` | Existing visual system and reusable controls | Directive says preserve existing UI | Preserve | Medium |
| `server/_core/index.ts` | Express startup, routes, Vite/static serving | Deployment/API boundary | Preserve except narrowly additive routes | High: port/startup failure causes deployment failure |
| `server/_core/storageProxy.ts` | Same-origin streaming proxy for lifecycle-managed model/WASM assets | Browser-local runtime asset boundary | Additive | High: redirects to cross-origin signed URLs break browser CSP/CORS |
| `server/_core/context.ts` | Authentication context and beta-open identity injection | Auth boundary | Preserve; beta flag must remain temporary | Critical: public access if beta remains enabled |
| `server/_core/trpc.ts` | Public/protected/admin middleware | Authority boundary | Preserve | Critical |
| `server/_core/env.ts` | Server environment mapping | New config must be explicit and server-only | Controlled extension only | High |
| `server/routers.ts` | Root tRPC router | New API routes should be additive and typed | Preserve structure | High |
| `server/portal-chat-router.ts` | Portal conversation, APEX, memory, adaptation, identity procedures | Existing active API | Preserve contracts; add separate routers where possible | Critical: user scoping and receipt semantics |
| `server/apex-canonical.ts` | Ten-stage deterministic orchestration | Must remain callable without MIST/LLM | Preserve | Critical |
| `server/deterministic-engine.ts` | Deterministic primitives | Non-negotiable preservation target | Do not rewrite | Critical |
| `server/sovereign-bus.ts` | Capability resolver, receipts, locality boundaries | Governance foundation | Preserve; extend only through compatible contracts | Critical |
| `server/local-model.ts` | Local provider interface, JSON Schema, llama.cpp GBNF | Reusable provider boundary | Preserve; add only compatible adapters/tests | High |
| `server/local-gateway.ts` | Deterministic fallback/local invocation | Must remain usable with model unplugged | Preserve | Critical |
| `server/governed-local-intelligence.ts` | Evidence-bounded local generation | Candidate Phoenix integration boundary | Preserve; add a separate claim contract | High |
| `server/reflection-engine.ts` | Bounded deterministic reflection | Not Phoenix; reusable bounded safety primitive | Preserve | High |
| `server/memory-fabric.ts` | In-memory memory contracts/context assembly | Useful provenance model, not corpus store | Preserve | Medium |
| `server/keira-durable-memory.ts` | Database-backed memory/receipts | Existing durable operator memory | Preserve | High |
| `server/offline-resilience.ts` | In-process degradation/queue model | Must not be mistaken for durable queue | Preserve; future persistence adapter | High |
| `server/keira-identity.ts` | KEIRA canonical manifest and Ed25519 identity receipt | Separate from trajectory attestation | Preserve; do not conflate | Critical |
| `server/keira-identity-persistence.ts` | Encrypted private-key lifecycle and receipt persistence | Security boundary | Do not expose private material | Critical |
| `server/db.ts` | Drizzle database helpers and user lifecycle | Storage extension point | Preserve; add repository helpers | High |
| `drizzle/schema.ts` | MySQL/TiDB schema | Corpus/MIST persistence candidate | Additive migrations only after design approval | Critical |
| `drizzle/*.sql`, `drizzle/meta/*` | Migration history | Database compatibility | Do not edit old migrations | Critical |
| `server/*.test.ts` | Current unit/integration/adversarial suite | Regression gate | Preserve and extend | High |
| `server/_core/security-headers.ts` | Security headers | Browser/API security | Preserve; review CORS separately | High |
| `server/_core/vite.ts` | Dev/prod asset serving | Deployment boundary | Preserve | High |
| `package.json`, `pnpm-lock.yaml` | Build/dependency contract | Dependency audit required before additions | Modify only after compatibility proof | High |
| `vite.config.ts`, `tsconfig.json`, `drizzle.config.ts` | Tooling/build/schema config | Runtime compatibility | Preserve unless required | Medium |
| `deploy-lightsail.sh`, `LIGHTSAIL_DEPLOYMENT_GUIDE.md` | Historical Lightsail deployment | Current project is hosted Manus; not active deployment target | Do not use as implementation basis | Medium |
| `DEPLOYMENT.md` | Manus hosted deployment notes | Current deployment reference | Update only after deployment changes | Medium |
| `KEIRA_SOVEREIGN_RUNTIME.md` | Existing runtime documentation | Must be updated only after verified implementation | Preserve until Phase 1+ | Low |

## Phase tracking and future file impact

### Phase 1 — preservation

- `ARCHITECTURE_AUDIT.md` — created now.
- `FILE_IMPACT_MATRIX.md` — created now.
- `DEPENDENCY_AUDIT.md` — created now.
- `DEPLOYMENT_AUDIT.md` — created now.
- `DETERMINISTIC_BASELINE.md` — preservation contract and required release commands.
- `server/deterministic-preservation-baseline.test.ts` — cross-module deterministic regression tripwires.

### Phase 2 — corpus/storage foundation

Implemented browser-local foundation:

- `client/src/lib/corpus/types.ts` — versioned document, chunk, embedding, CID, metadata, and store contracts.
- `client/src/lib/corpus/ingest.ts` — deterministic Markdown/TXT normalization, sectioning, token-aware chunking, and SHA-256 CIDs.
- `client/src/lib/storage/interface.ts` — storage abstraction.
- `client/src/lib/storage/indexeddb-corpus-store.ts` — IndexedDB implementation with cascading local deletion.
- `server/corpus-foundation.test.ts` — ingestion and storage contract tests using a dev-only IndexedDB shim.
- `CORPUS_FOUNDATION.md` — actual implementation boundary and required validation.

Explicitly deferred: PDF/OCR parsing, corpus UI, browser upload flow, MIST retrieval, and all later trajectory work. Phase 3 embedding proof is tracked below.

### Phase 3 — browser-local embedding proof

- `client/src/lib/embedding/types.ts` — provider-neutral contract, lifecycle, cache, and vector metadata.
- `client/src/lib/embedding/transformersjs-provider.ts` — Transformers.js/ONNX Runtime Web adapter with no hosted fallback.
- `server/local-embedding-provider.test.ts` — deterministic lifecycle, cache-observation, dimension, and failure tests.
- `server/_core/storageProxy.ts` — same-origin byte-stream proxy with range/content-type preservation.
- `server/_core/security-headers.ts` and `server/portal-security-audit.test.ts` — minimal CSP allowance for WebAssembly compilation without unrestricted JavaScript eval.
- `PHASE3_EMBEDDING_PROOF.md` — live browser evidence and verified runtime boundary.

Status: **verified browser-local model execution**. Same-origin model and ONNX Runtime WASM assets produced `MODEL_READY` and a finite 384-dimensional vector. MIST remains deferred.

### Phase 3.5 — local corpus similarity search

- `client/src/lib/corpus/local-similarity.ts` — provider/store bridge that persists exact-provenance vectors and performs fail-closed cosine similarity ranking.
- `client/src/lib/corpus/types.ts`, `client/src/lib/storage/interface.ts`, and `client/src/lib/storage/indexeddb-corpus-store.ts` — additive semantic result/index contracts and deterministic embedding enumeration.
- `server/corpus-similarity.test.ts` — indexing, reuse, provenance isolation, malformed-vector, and empty-query coverage.
- `CORPUS_SIMILARITY_SEARCH.md` — verified scope and explicit deferrals.

Status: **implemented and test-covered**. This is local semantic retrieval over persisted chunks, not MIST L1-L7 or Portal Chat integration.

### Phase 4 — embeddings and MIST

- `client/src/lib/mist/types.ts` — typed MIST result, layer, candidate, fusion, and in-memory trajectory contracts.
- `client/src/lib/mist/core.ts` — deterministic L1 lexical, L2 semantic, L3 centroids, L4 Echoes, L5 Patterns, L6 Arcana, and L7 RRF fusion over the existing local corpus/embedding abstractions.
- `server/mist-core.test.ts` — complete-layer, deterministic reuse, empty-corpus, and unavailable-embedding tests.
- `server/mist-trajectory.ts` — validated persistence handoff, canonical leaf hashing, deterministic SHA-256 Merkle construction, and user-scoped read/list helpers.
- `server/mist-trajectory.test.ts` — canonicalization, odd-leaf, mutation-sensitivity, and malformed-input tests.
- `drizzle/schema.ts`, `drizzle/0015_empty_catseye.sql`, and `drizzle/meta/0015_snapshot.json` — additive trajectory envelope and immutable leaf tables.
- `server/routers.ts` — protected persist/read/list procedures under `portal`.
- `MIST_CORE.md` — documented constants, failure semantics, browser proof, and deferred work.

Status: **implemented and browser-proven**. The core emits a bounded RRF trajectory and the protected server handoff durably stores its canonical Merkle commitment. Independent re-execution, signed MIST reports, verifier UI, and real-data visualizer binding are implemented. Phoenix remains deferred.

### Phase 5–10 — Boomerang Swarm completion

- `client/src/lib/boomerang/*` — bounded three-agent traversal, digestive envelopes, top-30 weighted fusion, deterministic Merkle commitment, and attestation-ready result contract.
- `server/boomerang-persistence.ts`, `server/boomerang-phase5-10.test.ts`, and `BOOMERANG_SWARM_PHASE5_10.md` — canonical server persistence, durable Ed25519 signing through KEIRA’s existing identity, and acceptance coverage.
- `drizzle/schema.ts`, `drizzle/0017_pale_gorgon.sql`, and `drizzle/meta/0017_snapshot.json` — additive durable Boomerang result table.
- `client/src/components/BoomerangRadar.tsx` and `client/src/pages/PortalChat.tsx` — real-data orbital visualizer and local MIST-to-Boomerang handoff.

Status: **implemented and test-covered**. Mesh transport, peer registries, and Phoenix remain deferred.

### Phase 8 — UI intelligence surfaces

- Additive components for Echoes, Patterns, Arcana, Trajectory, MIST visualizer, Corpus, and Settings.
- No simulated telemetry; each component must render actual state or `NOT RUN`/`UNAVAILABLE`.

### Phase 9 — SSO/mesh

- Explicit KEIRA SSO/state/event contracts after the existing XINUS mesh API is located and verified. No direct browser WireGuard or mesh credential handling.

## Files that must not be modified casually

1. `server/deterministic-engine.ts`
2. `server/apex-canonical.ts`
3. `server/sovereign-bus.ts`
4. `server/local-gateway.ts`
5. `server/local-model.ts`
6. `server/reflection-engine.ts`
7. `server/_core/trpc.ts`
8. `server/_core/context.ts`
9. `server/keira-identity-persistence.ts`
10. Existing migration SQL and Drizzle metadata history
11. Existing acceptance/adversarial tests

Changes to these files require a focused compatibility test and explicit regression evidence.

## Files that are safe candidates for additive work

- New `server/corpus/*`, `server/mist/*`, `server/phoenix/*`, and `server/attestation/*` modules.
- New typed tRPC routers mounted under `appRouter` without changing existing procedure semantics.
- New client components under `client/src/components/keira/`, `client/src/components/mist/`, and `client/src/components/settings/`.
- New pages/routes added without replacing `/` or `/portal-chat`.
- New tests with no weakening of existing assertions.

## Prohibited impact in the next phase

- Replacing the existing Portal Chat UI.
- Rewriting deterministic behavior to depend on a model.
- Adding hosted AI providers or a remote vector database.
- Moving private signing keys into browser code or localStorage.
- Making protected procedures public as a shortcut; beta-open behavior must remain an explicit server flag.
- Changing the database provider or deleting existing records.
