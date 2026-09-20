# KEIRA Provider Dependency Audit

## Conclusion

KEIRA has **no required external AI provider**. The active intelligence path is deterministic first, optional local-model inference second, and reserved local tools/trusted mesh lanes thereafter. External AI providers are disabled.

## Classification

| Occurrence or subsystem | Classification | Current treatment |
| --- | --- | --- |
| `server/local-gateway.ts` | **IMPLEMENTED** | Provider-neutral OpenAI-compatible wire protocol for a local endpoint only; no external vendor is required. |
| `server/sovereign-bus.ts` | **IMPLEMENTED** | Explicit capability resolver; external-provider lane is disabled and cannot be a silent fallback. |
| `server/deterministic-engine.ts` | **IMPLEMENTED** | Local normalization, classification, contradiction, planning, policy, and state primitives with receipts. |
| `server/runtime-discovery.ts` | **IMPLEMENTED** | Probes only the explicitly configured local `/models` endpoint. |
| `server/reflection-engine.ts` | **IMPLEMENTED** | Bounded, deterministic reflective cycle with a hard recursion limit. |
| `server/sovereign-memory.ts` | **IMPLEMENTED** | Local memory metadata, authorization, retention, provenance, and revocation abstraction. |
| `@aws-sdk/client-bedrock-runtime` and Bedrock gateway | **REMOVE** | Removed from source, manifest, lockfile, and active tests. |
| `BEDROCK_*` variables | **REMOVE** | Removed from active runtime and deployment configuration. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | **OPTIONAL / STORAGE ONLY** | Retained only for the separate optional S3 storage path; never used for AI inference. |
| `PORTAL_S3_BUCKET` / `PORTAL_S3_REGION` | **OPTIONAL / STORAGE ONLY** | Optional transcript export storage. |
| Historical Bedrock guide and historical architecture references | **DOCUMENTATION_ONLY** | Clearly marked superseded or deprecated; no active deployment procedure remains. |
| Competitor names and external research citations in benchmark documents | **DOCUMENTATION_ONLY** | Historical competitive-analysis material; not runtime dependencies or inference integrations. |

## Runtime acceptance

The verified release gate demonstrates:

- `pnpm check` passes.
- Full Vitest suite passes: **112 passed, 1 expected skip**.
- Production build passes.
- `bash -n deploy-lightsail.sh` passes.
- No active source or deployment file references Bedrock configuration.
- Deterministic operations return receipts with `external_service_used: false` and `data_left_local_node: false`.
