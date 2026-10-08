# Ollama with KEIRA on Hosted Manus

## Important deployment boundary

The hosted Manus site runs in a managed server environment. It cannot start or reach `127.0.0.1:11434` on your personal computer. Ollama must therefore run on a machine you control and be exposed to the hosted site through a secured HTTPS endpoint.

If no endpoint is configured, KEIRA intentionally uses its deterministic runtime and reports local-model inference as unavailable. It does not pretend that an Ollama model is running.

## Recommended model

For a modest self-hosted machine:

```text
qwen2.5:3b
```

It is a small open model suitable for conversation and structured transformation. Larger models may be better but require more memory and slower inference.

## Run Ollama on your controlled machine

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull qwen2.5:3b
ollama run qwen2.5:3b
```

Do not expose Ollama directly to the public internet without an authenticated HTTPS reverse proxy. The Ollama service should remain bound to localhost; the reverse proxy should enforce authentication, TLS, request-size limits, and rate limits.

The endpoint KEIRA expects is the OpenAI-compatible Ollama API base:

```text
https://your-authenticated-ollama-host.example/v1
```

KEIRA calls `/chat/completions` and `/models` through this base URL.

## llama.cpp constrained decoding

For a llama.cpp server, configure the same endpoint shape with:

```text
LOCAL_LLM_BASE_URL=https://your-authenticated-llama-host.example/v1
LOCAL_LLM_RUNTIME=llama.cpp
LOCAL_LLM_MODEL=your-local-model
```

When KEIRA uses the governed structured-generation path, the adapter sends:

1. `response_format.type=json_schema` with the canonical KEIRA output schema; and
2. a fixed GBNF grammar for the response object, claims, evidence references, unknowns, next step, and confidence.

This constrains output **syntax and shape** at the llama.cpp runtime. It does not certify facts, authorize actions, or replace KEIRA’s deterministic evidence adjudication. The response is still validated again after generation.

## Configure the hosted Manus project

Add these as server-side project secrets/environment variables. Do not put them in browser code or commit them to Git:

```text
LOCAL_LLM_BASE_URL=https://your-authenticated-ollama-host.example/v1
LOCAL_LLM_RUNTIME=ollama
LOCAL_LLM_MODEL=qwen2.5:3b
LOCAL_LLM_API_KEY=your-proxy-token-if-required
LOCAL_LLM_MAX_TOKENS=4096
LOCAL_LLM_TEMPERATURE=0
LOCAL_LLM_TOP_P=1
LOCAL_LLM_SEED=42
LOCAL_LLM_TIMEOUT_MS=60000
```

`LOCAL_LLM_BASE_URL` is intentionally blank by default on hosted deployments. This prevents a false claim that the hosted container has an Ollama daemon.

## What KEIRA guarantees

- The local adapter sends requests only to the configured server-side endpoint.
- `temperature=0`, `top_p=1`, and `seed=42` are sent by default for reproducible generation.
- Model output remains `GENERATED_INFERENCE`, never automatic truth or authorization.
- Structured outputs are validated and claims are adjudicated against supplied evidence.
- llama.cpp receives both JSON Schema and GBNF constraints; Ollama receives the JSON Schema request format without a GBNF claim.
- If the endpoint is unreachable or returns malformed output, KEIRA falls back to the deterministic runtime.
- Receipts record `external_service_used=false` only when the configured endpoint is classified as local/self-hosted by the application contract; an internet-facing proxy must be treated as an operator-controlled boundary and audited accordingly.

## Current evidence

The adapter and hosted-safe defaults are implemented and tested. A live Ollama model is **not** connected until an authenticated HTTPS endpoint is supplied in the hosted project environment. Without that endpoint, deterministic mode is the truthful active behavior.
