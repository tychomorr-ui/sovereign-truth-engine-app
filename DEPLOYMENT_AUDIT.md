# KEIRA Deployment Audit

**Audit phase:** Step 0 with Phase 3 browser-runtime addendum
**Audited commit:** `332f289`  
**Current target:** Hosted Manus WebDev project, not Lightsail.

## Current hosted deployment model

The active project is a Manus WebDev full-stack application. The build command is:

```text
pnpm build
```

which runs:

```text
vite build
esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

The production start command is:

```text
NODE_ENV=production node dist/index.js
```

The server reads `PORT` and defaults to `3210`; production binds to `0.0.0.0`, while development searches for an available port starting at `3210`. Static assets are served from `dist/public` in production. Development uses Vite middleware.

The project has been repeatedly validated in the hosted sandbox with a successful production build and the current test suite. The current project checkpoint is `332f289b`.

## Runtime routes and transport

| Route/transport | Current status |
|---|---|
| `/` and `/portal-chat` | Portal Chat frontend routes |
| `/api/trpc` | Primary typed backend API |
| `/api/beta-status` | Public beta-mode status; currently reports temporary beta session |
| `/api/keira-identity/health` | Public-safe identity encryption readiness status |
| `/.well-known/keira-identity.json` | Public KEIRA identity manifest/status |
| `/.well-known/keira-receipt.json` | Public KEIRA identity receipt/status |
| `/manus-storage/{key}` | Same-origin streaming proxy for lifecycle-managed model and ONNX WASM assets |
| SSE/WebSocket | Not implemented/found in active server routes |
| Browser → Ollama | Not used by current code; server-side fetch is used |

## Authentication posture

Normal deployment expects session-based sovereign authentication and protected tRPC procedures. The hosted project is currently intentionally configured with `BETA_OPEN_MODE=true` for operator testing. In this mode, requests without a valid session are assigned a dedicated non-owner `beta@keira.local` user. The beta user has `role=user`, no password, and cannot use admin procedures.

This configuration is suitable only for controlled beta testing. It is not safe for a public production deployment because all anonymous visitors share the same beta identity and therefore the same beta-owned conversations/context/memory surfaces. Set `BETA_OPEN_MODE=false` and restart before production use.

## Environment/configuration findings

Observed server environment mappings include:

- `DATABASE_URL` — database connection.
- `JWT_SECRET` — session cookie signing secret.
- `PORTAL_OWNER_ACCESS_TOKEN` — owner bootstrap secret.
- `KEIRA_IDENTITY_ROOT_SECRET` — server-only encryption root for KEIRA's private identity key.
- `BETA_OPEN_MODE` — temporary beta-open switch.
- `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_RUNTIME`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_API_KEY`, and local generation limits — optional local inference configuration.
- `PORTAL_S3_BUCKET`, `PORTAL_S3_REGION`, and AWS credentials — optional storage path.

No secret values are committed in the repository. Browser-exposed Vite variables must be treated separately from server-only environment variables.

## Local Ollama topology

The current local-model adapter expects a server-reachable OpenAI-compatible base URL, for example:

```text
http://127.0.0.1:11434/v1
```

or an operator-controlled private network endpoint. The server calls:

```text
GET  <base>/models
POST <base>/chat/completions
```

The attached directive proposes `http://10.9.0.1:11434/v1` for production. That address is not verified reachable from the Manus WebDev environment and should be treated as an unverified future topology. The correct development state is local-model unavailable or unverified, not fabricated health.

The expected future topology is:

```text
Browser
  ↓ HTTPS
KEIRA hosted API
  ↓ private routed connection / tunnel / colocated network
Operator-controlled Ollama
  ↓
Local model
```

A browser should not be configured to call `10.9.0.1:11434` directly unless the actual browser network and CORS behavior are tested in the deployment environment. The current code correctly keeps model calls server-side.

## Reverse proxy and HTTPS

The application has `app.set("trust proxy", 1)` and security headers. The current repository contains historical Lightsail/Nginx deployment material, but the active target is hosted Manus. No live Nginx/Caddy/Traefik configuration is part of this project, and no reverse-proxy-to-Ollama path has been verified here.

The application itself does not currently include an explicit CORS allowlist middleware. Same-origin tRPC operation is the normal hosted path. The directive's required allowlist for `https://keira.nexinus.net` and approved localhost origins is therefore **not implemented/verified**. This should be designed before introducing cross-origin clients or a separate scraper origin.

## Database/deployment consistency

Drizzle migrations are part of the repository and current schema checks have passed in the existing release gate. The offline resilience queue remains process-local and does not survive a process restart unless the caller explicitly snapshots/restores it. cMAP mission state is also in-memory per conversation. These are deployment-relevant limitations if horizontal scaling or automatic restarts are expected.

## Static asset and build findings

- Production build succeeds.
- The frontend bundle emits a Vite warning for a chunk larger than 500 kB; this is a performance warning, not a deployment failure.
- No Dockerfile or active container orchestration manifest was found.
- Historical `deploy-lightsail.sh` is not the current hosted deployment mechanism.
- The active server entrypoint is suitable for the hosted WebDev build contract.
- The pinned MiniLM model files and ONNX Runtime WASM files are lifecycle-managed assets, not repository files in `client/public`; the server proxy streams them same-origin with range and content-type preservation.

## Deployment verification status

| Check | Status | Evidence boundary |
|---|---|---|
| Hosted dev server starts | Proven | WebDev restart/status output |
| Production build | Proven | `pnpm build` passed in current release gate |
| TypeScript | Proven | `pnpm check` passed in current release gate |
| Existing tests | Proven | 191 passed, 1 expected skip at audited beta commit |
| Database schema consistency | Previously proven for current release | Must rerun after future schema changes |
| `HTTPS hosted endpoint` | Platform-managed/available through WebDev | Not a repository-owned reverse proxy |
| `Browser-local MiniLM embedding proof` | Proven | Chromium loaded same-origin model/WASM assets and observed `MODEL_READY`, finite 384-dimensional vector, and four cache entries |
| `Browser-local corpus similarity` | Proven | Chromium persisted two MiniLM vectors in IndexedDB and ranked a River query above Mountain by local cosine similarity |
| `Browser-local MIST core` | Proven | Chromium executed L1–L7 over four persisted MiniLM vectors and returned an in-memory RRF trajectory; no Merkle/attestation claim |
| Local Ollama live reachability | Unverified | Requires operator topology and endpoint configuration |
| `10.9.0.1:11434` reachability from Manus | Not established | Do not claim connectivity |
| CORS allowlist | Not implemented/verified | Same-origin only is the safe current assumption |
| Nginx/Caddy/TLS proxy chain | Not verified in current target | Historical Lightsail docs are not evidence |
| Corpus upload/corpus persistence | Browser-local IndexedDB foundation implemented and API-contract tested | No upload UI, PDF parser, or live browser acceptance yet |
| MIST/Phoenix acceptance | Not implemented | Directive Phase 3+ required |

## Deployment risks

1. Leaving beta-open mode enabled exposes a shared non-owner identity.
2. Attempting to reach a private Ollama address from hosted Manus may fail due to network isolation; failure must remain explicit.
3. A process-local queue and in-memory cMAP state are not safe assumptions under restart or multiple instances.
4. Cross-origin scraper/API access is not configured with an explicit allowlist.
5. The current public identity receipt is KEIRA identity provenance, not MIST trajectory attestation.
6. Corpus persistence has no UI/upload route or live browser quota/eviction verification; MIST deployment artifacts and acceptance routes do not yet exist.

## Recommended deployment sequence after audit approval

1. Keep the current hosted beta mode only for controlled testing.
2. Complete deterministic preservation baseline.
3. Build and test browser-local corpus storage in isolation.
4. Keep the verified local embedding runtime and cache behavior as the gate for corpus integration.
5. Implement MIST layers independently, then compose trajectory/fusion.
6. Add backend-only trajectory attestation separate from KEIRA identity receipts.
7. Add structured claim verification and bounded Phoenix recursion.
8. Add explicit CORS allowlist only when a real cross-origin client is required.
9. Configure and live-test the private Ollama route in the actual production topology.
10. Disable beta-open mode, run full acceptance, and only then publish as a public production service.
