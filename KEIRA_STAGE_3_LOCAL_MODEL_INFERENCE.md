# KEIRA Stage 3 — Local Model Inference

## Objective

Local model inference is an optional, replaceable capability. It is not KEIRA, the authority layer, policy engine, provenance system, source of truth, or security boundary. The deterministic runtime remains the fallback and does not require a model.

## Architecture

```text
Portal Chat API
  → Sovereign Bus
    → deterministic capability (always available)
    → local model capability (optional)
      → LocalModelProvider interface
        → OpenAI-compatible local adapter
          → Ollama / llama.cpp / vLLM-compatible endpoint
    → no silent external fallback
  → KEIRA evaluates generated inference
  → receipt records provider, model, endpoint class, locality, request, state, and latency
```

The active local adapter is `OpenAiCompatibleLocalProvider`. Provider naming is detected as Ollama, llama.cpp, vLLM, or generic OpenAI-compatible-local from the configured runtime label. No client can provide an arbitrary endpoint; the endpoint is server-side configuration.

## Provider-neutral interface

```ts
interface LocalModelProvider {
  generate(request): Promise<ModelResult>;
  stream(request): AsyncIterable<string>;
  health(signal?): Promise<ModelHealth>;
  modelInfo(signal?): Promise<ModelRegistryEntry>;
  capabilities(): readonly ModelCapability[];
  cancel(requestId): boolean;
  estimateUsage(request): { inputTokens: number; maxOutputTokens: number };
}
```

`generate()` returns a request ID, provider, model, endpoint class, local flag, locality result, generated-inference state, latency, and optional usage. `stream()` is bounded through the same generation contract in this release. `health()` checks endpoint reachability and model listing. `cancel()` and caller abort signals prevent unbounded work.

## Model registry

`ModelRegistryEntry` records:

- model ID and provider;
- endpoint and model name;
- context window and quantization when known;
- supported capabilities;
- status (`CONFIGURED_NOT_VERIFIED`, `HEALTHY`, `UNAVAILABLE`, `DISABLED`, or `ERROR`);
- local-only and enabled flags;
- health details and last-checked time.

Configuration is not treated as proof that a model exists. Health must discover the runtime and model.

## Routing and data boundary

Routing remains deterministic-first. A configured local model is used only when selected by the existing local capability path. External providers remain disabled. The local provider accepts explicit context-boundary metadata and rejects `PROHIBITED_FOR_EXTERNAL_PROCESSING` before transmission. Local-only data is never sent to an external endpoint by this adapter.

The protected Portal API now exposes factual `getLocalModelStatus` metadata. It reports configured/verified/healthy state rather than decorative availability.

## Output truth status

Every successful local model response is classified as:

```text
resultState = GENERATED_INFERENCE
```

It is never automatically classified as `VERIFIED`, `TRUE`, `AUTHORIZED`, `EXECUTED`, or `COMPLETED`. KEIRA’s deterministic evidence and authority layers remain responsible for evaluating any model output.

## Exact configuration used for testing

The tests do not require an installed model or network access. They instantiate the adapter with explicit test-only configurations:

| Test | Runtime | Endpoint | Model |
|---|---|---|---|
| Health/discovery | Ollama label | `http://127.0.0.1:11434/v1` | `keira-test` |
| Successful generation | vLLM label | `http://127.0.0.1:8080/v1` | `test-model` |
| Boundary/malformed/cancel tests | Ollama label | `http://127.0.0.1:11434/v1` | `model` |

`fetch` is mocked in these tests; therefore they verify protocol behavior and failure handling, not a live model installation. No live local model was configured in the test environment.

## Evidence report

| Category | Status | Evidence |
|---|---|---|
| Replaceable local provider interface | **IMPLEMENTED / VERIFIED** | `server/local-model.ts`; interface and focused tests. |
| Ollama/llama.cpp/vLLM-compatible routing | **IMPLEMENTED / VERIFIED AS PROTOCOL ADAPTER** | Runtime label mapping and OpenAI-compatible request shape tested. |
| Model registry | **IMPLEMENTED / VERIFIED** | Registry entry preservation and unverified status test. |
| Health and model discovery | **IMPLEMENTED / VERIFIED AS MOCKED PROTOCOL** | `/models` discovery, loaded/not-loaded state, latency, and failure tests. |
| Generated-inference classification | **IMPLEMENTED / VERIFIED** | Successful generation test and sovereign receipt state `GENERATED_INFERENCE`. |
| Local-only data protection | **IMPLEMENTED / VERIFIED** | Prohibited processing fails before fetch. |
| Cancellation and timeout behavior | **IMPLEMENTED / VERIFIED** | Abort-signal test; provider timeout is bounded by configured timeout. |
| External fallback disabled | **VERIFIED** | Existing sovereign runtime tests and bus policy keep external provider disabled. |
| Live local inference | **UNVERIFIED** | No actual Ollama, llama.cpp, or vLLM endpoint was installed/configured during this run. |
| Live model health | **UNVERIFIED** | Health protocol is tested with mocked fetch only. |
| Durable inference telemetry | **PARTIAL** | Request/latency/usage are returned in result/receipt paths; durable storage remains future work. |
| External authorized inference | **BLOCKED** | External providers remain disabled and no external authority/policy contract is configured. |

## Remaining risks

A live runtime must still be provisioned and measured before claiming local AI is operational. Context window and quantization remain unknown unless supplied by the runtime. Stream cancellation is implemented through the bounded generation path but is not yet token-stream native. Tool execution is not exposed through model output. Generated text cannot bypass the deterministic policy or authority layers.
