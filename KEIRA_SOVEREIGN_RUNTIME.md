# KEIRA Sovereign Local Runtime

## Scope

This document describes the provider-independent intelligence path implemented in KEIRA. **KEIRA is the intelligence system.** A local language model is an interchangeable inference capability; it is not KEIRA's identity, memory, policy, or application contract.

## Canonical path

```text
NEXINUS
  ↓
KEIRA
  ↓
APEX CANONICAL
  ↓
SOVEREIGN INTELLIGENCE BUS
  ├─ Deterministic Engine
  ├─ Local Model Runtime
  ├─ Local Tool Runtime (allow-listed/reserved)
  ├─ Reflection Engine
  ├─ Sovereign Memory
  └─ Provenance Receipts
```

The current routing contract is local-first. Deterministic operations are explicit and do not invoke a model. Conversational generation may request a local model; if none is configured, the deterministic responder remains available. External AI providers are disabled and are not a fallback.

## Runtime states

The runtime reports factual states rather than interface presence as proof of intelligence:

| Area | States in this release |
| --- | --- |
| Deterministic engine | `READY` |
| Local model | `MODEL_READY`, `MODEL_AVAILABLE`, `MODEL_NOT_CONFIGURED`, `MODEL_UNAVAILABLE`, or `MODEL_ERROR` |
| Local memory | `READY` |
| Local tools | `AVAILABLE` for the allow-listed/reserved lane |
| Trusted mesh | `NOT_CONFIGURED` |
| External providers | `DISABLED` |
| Offline mode | `AVAILABLE` |
| Provenance | `READY` |

The `/api/trpc/portal.chat.getRuntimeStatus` procedure exposes the status to the authenticated Interface panel. The local runtime probe checks the configured OpenAI-compatible `/models` endpoint only when a local endpoint is configured.

## Receipts

Each intelligence operation returns a receipt with a unique identifier, timestamp, operation name, intelligence mode, provider, model, context sources, external-service flag, locality flag, policy, verification statement, and result state. Measurements that are not available are represented as `null` or an explicit unavailable state; they are not fabricated.

Example deterministic receipt:

```json
{
  "receipt_id": "generated-at-runtime",
  "timestamp": "generated-at-runtime",
  "operation": "deterministic.normalize",
  "intelligence_mode": "deterministic",
  "provider": "deterministic-engine",
  "model": null,
  "context_sources": [],
  "external_service_used": false,
  "data_left_local_node": false,
  "policy": "deterministic lane; no model inference",
  "verification": "normalized locally without model inference",
  "result_state": "PROVEN"
}
```

## Deterministic lane

`server/deterministic-engine.ts` contains bounded primitives for normalization, lexical classification, contradiction detection, bounded planning, policy evaluation, and state comparison. These are intentionally not replaced by an LLM. Each operation emits a receipt.

## Local model lane

`server/local-gateway.ts` supports the common OpenAI-compatible `/v1/chat/completions` and `/v1/models` shapes. This permits Ollama, llama.cpp server, vLLM, or another local-compatible runtime without coupling KEIRA to one runtime. The optional variables are:

```bash
LOCAL_LLM_RUNTIME=ollama
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=your-installed-model
LOCAL_LLM_API_KEY=
```

A configured local model that fails is bounded by a deterministic fallback. The receipt records that fallback and does not mark the response as a successful local-model response.

## Reflection and recursion

Reflection is separate from generation. `server/reflection-engine.ts` performs bounded inspection of supplied evidence, identifies missing evidence, and terminates at a hard maximum depth. It does not claim consciousness, sentience, supernatural knowledge, or uncontrolled self-modification.

## Memory

`server/sovereign-memory.ts` provides a local memory abstraction with the required classes: short-term context, session memory, long-term memory, user-authorized memory, system state, and evidence memory. Each record carries source, timestamp, authority, sensitivity, retention, provenance, and revocation state. Revoked records are excluded from reads.

This abstraction is the provenance-safe foundation. Existing conversation and context-ledger persistence remains in the application database and is not silently reclassified as authorized long-term memory.

## Security boundaries

The runtime does not grant arbitrary shell execution, arbitrary filesystem authority, unauthorized remote control, credential extraction, silent network access, or automatic external data transmission. Local runtime discovery is limited to the configured local model endpoint. AWS S3 remains a separate optional storage dependency; it is not an AI inference dependency.

## Evidence status

| Claim | Status |
| --- | --- |
| KEIRA starts without an external AI provider | **PROVEN** by offline deterministic tests and build verification |
| Deterministic operations do not invoke model inference | **PROVEN** by deterministic lane implementation and receipts |
| External AI provider fallback is disabled | **PROVEN** by capability resolver and tests |
| Local model can be used through a compatible endpoint | **PARTIALLY_PROVEN**; adapter and contract are implemented, live runtime requires local model provisioning |
| Ollama, llama.cpp, and vLLM are individually tested in this environment | **UNPROVEN** until each runtime is installed and probed |
| GPU, quantization, context length, and memory telemetry | **NOT_IMPLEMENTED** unless the configured runtime exposes it |
| Durable database-backed provenance receipts for every historical message | **NOT_IMPLEMENTED**; current receipts are returned at operation time |
