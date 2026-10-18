# KEIRA Dependency Audit

**Audit phase:** Step 0 — inspection only  
**Audited commit:** `332f289`  
**Purpose:** Identify actual dependencies, prohibited dependencies, proposed additions, and runtime compatibility risks before implementation.

## Current package/runtime baseline

| Area | Observed implementation |
|---|---|
| Package manager | pnpm; package declares `pnpm@10.4.1` package manager metadata |
| Language/runtime | TypeScript 5.9, Node-oriented server runtime, ESM package |
| Frontend | React 19, React DOM, Vite 7, Tailwind 4, Wouter |
| Backend | Express 5, tRPC 11, SuperJSON |
| Database | Drizzle ORM 0.45, MySQL2 3.15, MySQL/TiDB-style schema |
| Tests | Vitest 2.1 |
| Build | Vite frontend build plus esbuild server bundle to `dist/index.js` |
| Auth/crypto | `jose`, Node crypto, existing sovereign auth/session helpers |
| UI | Radix primitives, Lucide, Streamdown, Sonner, Framer Motion |
| Storage | Existing optional S3 SDK/presigner dependency; database persistence; no corpus IndexedDB abstraction |
| Payments/other | Stripe package remains installed, but the active root router does not mount legacy payment routes |

## Current active intelligence dependencies

KEIRA's active inference implementation does **not** require a hosted AI SDK. `server/local-model.ts` and `server/local-gateway.ts` use standard `fetch` against an operator-configured OpenAI-compatible local endpoint. Runtime labels support Ollama, llama.cpp, vLLM, and generic local-compatible servers, while the sovereign capability layer disables external providers.

The deterministic runtime and APEX pipeline operate without a model. If the local endpoint/model is absent, deterministic fallback behavior remains available. This is an actual implementation property, not a claim that live Ollama is reachable in this environment.

## Prohibited or non-required provider dependencies

The directive prohibits OpenAI, Anthropic, Gemini, Groq, OpenRouter, Replicate, Together, HuggingFace hosted inference, and similar hosted inference APIs. No active source path for those providers was identified in the current sovereign runtime. Historical documents may contain vendor names and should not be treated as dependencies.

AWS SDK packages are present for optional S3/storage functionality. They are not the active AI inference path. Their continued presence should be treated as a storage dependency, not evidence of Bedrock usage.

## Directive-proposed dependencies

### `@xenova/transformers`

**Status:** Not currently installed.  
**Purpose:** Local embedding generation, target model `Xenova/all-MiniLM-L6-v2`.  
**Compatibility risks:** Browser bundle size, WebAssembly/WebGPU availability, model download/cache behavior, CSP, offline cache semantics, and deterministic version/model pinning. The directive explicitly requires compatibility verification before locking the implementation. No dependency should be added until a small isolated proof verifies the target environment and persistence behavior.

### `lancedb`

**Status:** Not currently installed.  
**Purpose:** Candidate logical/vector storage.  
**Compatibility risks:** LanceDB Node/server support must not be assumed to work in the browser. The directive itself identifies this risk. The least destructive approach is an application-level `CorpusStore` interface with IndexedDB as the browser physical store and an optional server adapter only if separately justified. No remote vector database is authorized.

### PDF/Markdown/TXT parsing

**Status:** No dedicated corpus parser pipeline was identified.  
**Risk:** PDF parsing can be server-only or add substantial browser weight; file size, worker, CSP, and untrusted-document handling must be designed before adding packages. Markdown/TXT can be handled with local deterministic parsing, but chunk provenance must preserve page/section/paragraph metadata where available.

### Browser IndexedDB

**Status:** Browser platform capability, not an installed package.  
**Purpose:** Required candidate for offline corpus persistence.  
**Risk:** Schema versioning, migrations, quota, eviction, multi-tab locking, and large embedding vectors need explicit tests.

## Existing package concerns

| Package/area | Finding | Recommended handling |
|---|---|---|
| `@aws-sdk/client-s3`, presigner | Optional storage path, not inference | Keep unless storage is formally removed; do not route model calls through it |
| `stripe` | Installed legacy capability | Not mounted in active root router according to current code; avoid touching during MIST work |
| `jose` and Node crypto | Existing auth/identity security | Reuse only through server-side boundaries; do not expose private keys |
| `streamdown` | Current chat rendering | Preserve for Portal Chat |
| `framer-motion` | Current UI motion dependency | Preserve; no broad UI rewrite in Phase 0 |
| `@tanstack/react-query`/tRPC | Current data layer | New MIST/corpus APIs should follow typed tRPC patterns unless browser-local operations deliberately remain client-only |
| `mysql2`/Drizzle | Current durable persistence | Do not assume it is suitable for browser-local corpus storage |

## Dependency additions not authorized by this audit

- Any hosted model SDK.
- Any remote vector database client.
- Any package that places signing keys in browser code.
- Any package added solely to simulate MIST telemetry.
- Any dependency that requires replacing the existing build system.
- Any package not accompanied by a compatibility proof and lockfile review.

## Recommended dependency evaluation sequence

1. Preserve current lockfile and run the existing suite.
2. Evaluate browser support for the selected embedding library in an isolated proof, including model cache and offline behavior.
3. Evaluate IndexedDB storage and schema versioning without MIST.
4. Decide whether a logical Lance-compatible schema is enough; do not add LanceDB unless runtime compatibility is demonstrated.
5. Add one dependency at a time with a focused test and bundle/build measurement.
6. Keep all dependency changes additive and reversible.

## Current audit verdict

The current dependency set is sufficient for Step 1 preservation and the existing deterministic/local-model runtime. It is **not yet sufficient** for the directive’s MIST/corpus/embedding/Phoenix acceptance criteria. The missing capabilities should be added incrementally only after compatibility proofs, not through a broad install or uncontrolled rewrite.
