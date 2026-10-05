# KEIRA Stage 7 — Governed Local Generative Intelligence

## Status

**Implemented as a controller-owned local transformation path.** The deterministic runtime remains authoritative. The local model is a stateless language transformation engine and cannot grant authority, decide verification, mutate protected state, or execute tools.

## Runtime path

```text
Portal request
  → deterministic context assembler
  → local-only boundary and policy fields
  → approved local adapter
  → structured output validation
  → claim normalization and evidence adjudication
  → deterministic response compiler
  → local/no-egress receipt
```

## Implemented

- Canonical context object with explicit source and provenance fields.
- Relevance/authorization/necessity filtering for supplied context and evidence.
- Versioned translator system contract.
- Response contracts: explanation, summary, classification, evidence review, next step, proposal, diagnostic, and adjudication input.
- JSON structured-output validation.
- Claim extraction and normalization.
- Claim states: `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED_BY_CURRENT_EVIDENCE`, `CONTRADICTED_BY_CURRENT_EVIDENCE`, and `UNKNOWN`.
- Deterministic fallback when no model exists or output is malformed.
- Local-only receipt fields: `external_service_used=false`, `data_left_local_node=false`.
- Model-agnostic local adapter extension for structured generation.
- Registry metadata fields for version, model hash, license, approval, and hardware requirements.
- Protected Portal endpoint `runGovernedLocalGeneration`.
- Tests covering supported, unsupported, malformed, unavailable, local-only, and injection cases.

## Evidence boundary

A valid JSON response is not a verified claim. Grammar/schema validity only establishes structural validity. Claims are separately adjudicated against supplied evidence. Model output remains `GENERATED_INFERENCE`; the governed result is not automatically `VERIFIED`.

## Fallback

When local inference is unavailable, KEIRA produces a deterministic fallback with an explicit unknown stating that local inference was unavailable. It does not simulate generated text or silently use cloud inference.

## Not implemented in this stage

- Actual GBNF/JSON-schema constrained decoding at the llama.cpp runtime level; the adapter sends a schema-directed prompt and validates the returned JSON.
- Cryptographic model hashes and signed model registry attestations; registry fields exist but are null unless a runtime supplies them.
- Live model installation or hardware-specific model selection; this stage does not install a model.
- Arbitrary tool execution; tool proposals remain outside this path.
- Automatic internal APEX memory retrieval/adaptation invocation; those remain separate controlled subsystems.
- Independent semantic truth verification beyond the supplied evidence set.

## Acceptance evidence

Focused Stage 7 suite: **20 tests passed** across governed local generation, local model adapter behavior, and APEX integration. Full repository verification remains required before checkpointing.
