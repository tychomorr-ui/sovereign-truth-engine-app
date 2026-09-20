# KEIRA — Security, API, and Self-Hosting Audit

**Audit scope.** This report covers the committed KEIRA source tree and its self-hosted production path: the Express entrypoint, tRPC router, first-party authentication, sovereign intelligence bus, deterministic engine, local-model adapter, local memory abstraction, optional S3 transcript storage, Vite build configuration, deployment helper, and tracked configuration artifacts. It is a source-and-build audit, not an attestation that a particular host has a local model, GPU, DNS, or network controls configured.

## Executive conclusion

KEIRA's active AI path is provider-independent. Deterministic operation is always available. An operator-controlled local model can be enabled through the local OpenAI-compatible adapter. External AI providers are disabled and are not a fallback. AWS remains only as an optional infrastructure dependency for MySQL/RDS and S3 exports when those services are chosen by the operator.

The build, strict TypeScript check, full Vitest suite, production build, source audit, and deployment-script syntax check are release gates. The current verified run reported **112 passing tests and 1 expected skip**.

| Area | Verified state | Operational requirement |
|---|---|---|
| Authentication | First-party password and owner-bootstrap sessions use signed HTTP-only JWT cookies. | Set strong, unique `JWT_SECRET` and `PORTAL_OWNER_ACCESS_TOKEN` values. |
| AI inference | Deterministic lane is active; local model is optional; external providers are disabled. | Leave local variables empty for offline deterministic mode or configure a local runtime. |
| Persistence | Drizzle uses `DATABASE_URL` for portable MySQL-compatible connectivity. | Enforce TLS to the database and restrict its network access. |
| Exports | Optional transcript object storage uses the existing storage path. | Configure S3 only if remote export storage is intentionally required. |
| Web edge | Nginx terminates TLS and proxies only to the configured loopback application port. | Expose ports `80` and `443`, not the application port. |

## Active API surface

The active tRPC router mounts only `auth.*` and `portal.chat.*` procedures. The regression suite verifies that legacy knowledge-graph, mirror, subscription, and platform-system procedures are not mounted.

The authenticated `portal.chat.getRuntimeStatus` procedure exposes factual deterministic/local-model/offline/provenance state. Chat responses include a provenance receipt describing the selected intelligence mode and whether data left the node.

## Runtime hardening

The Express entrypoint disables `X-Powered-By` and sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and a restrictive Content Security Policy. Nginx remains the public ingress. The deployment helper binds KEIRA locally and configures Nginx to route public traffic to the application loopback port.

The local runtime probe contacts only the explicitly configured local model endpoint. When no local endpoint is configured, KEIRA remains offline-capable and does not attempt external inference.

## Required production configuration

| Variable | Purpose | Keep secret? |
|---|---|---|
| `DATABASE_URL` | MySQL-compatible application database | Yes |
| `JWT_SECRET` | Signs first-party session cookies | Yes |
| `PORTAL_OWNER_ACCESS_TOKEN` | Gates owner bootstrap | Yes |
| `LOCAL_LLM_RUNTIME` | Informational runtime label such as `ollama`, `llama.cpp`, or `vllm` | No |
| `LOCAL_LLM_BASE_URL` | Optional local `/v1` inference endpoint | Operationally sensitive |
| `LOCAL_LLM_MODEL` | Optional installed local model name | No |
| `LOCAL_LLM_API_KEY` | Optional credential for the local endpoint | Yes |
| `PORTAL_S3_BUCKET` / `PORTAL_S3_REGION` | Optional transcript export storage | Bucket name is operationally sensitive |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Optional S3 storage authentication only | Yes |

There are no required Bedrock, OpenAI, Anthropic, Google AI, or other external AI variables.

## Sovereign runtime evidence

The deterministic lane emits receipts for normalization, classification, contradiction detection, bounded planning, policy evaluation, and state comparison. The reflection engine enforces a hard recursion limit. The sovereign memory abstraction requires source, timestamp, authority, sensitivity, retention, provenance, and revocation state for each record.

The following remain explicitly limited: individual Ollama/llama.cpp/vLLM live compatibility is not proven until each runtime is provisioned and probed; GPU, quantization, context-length, and memory telemetry are null unless exposed by the configured runtime; durable database-backed storage of every provenance receipt is not yet implemented.

## Git and release hygiene

Do not commit `.env` files, database passwords, local model API keys, IAM keys, owner keys, or generated transcript exports. The historical Bedrock guide is retained only as a deprecation record and contains no active deployment procedure.

## Release gate

```bash
pnpm check
pnpm test
pnpm build
bash -n deploy-lightsail.sh
```

After the service starts, verify the local process before routing live traffic:

```bash
curl -I http://127.0.0.1:3210/
pm2 status
pm2 logs keira-intelligence --lines 50
```

The detailed self-hosting procedure is maintained in [LIGHTSAIL_DEPLOYMENT_GUIDE.md](./LIGHTSAIL_DEPLOYMENT_GUIDE.md). Its inference configuration should follow `KEIRA_SOVEREIGN_RUNTIME.md`, not the historical Bedrock material.
