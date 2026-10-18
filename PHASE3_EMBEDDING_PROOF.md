# KEIRA Phase 3 — Browser-Local Embedding Proof

**Status:** **BLOCKED — local browser model execution was not proven.**

Phase 3 was intentionally stopped at the runtime-proof boundary. No MIST layer, Corpus UI, PDF parser, Ollama integration, LLM response generation, server API, database schema, trajectory attestation, or hosted embedding fallback was added.

## Repository/runtime audit

Before modification, KEIRA had:

- no embedding package;
- no worker, SharedWorker, WASM, WebGPU, or Cache API integration;
- no transformer runtime;
- a Vite React browser build with no special worker/WASM configuration;
- a browser-local `CorpusStore` abstraction and additive `CorpusEmbedding` record contract from Phase 2;
- Vitest tests executed in Node rather than a browser.

The live HTTPS preview reported these primitives as available:

```text
secureContext: true
WebAssembly: true
Cache API: true
IndexedDB: true
Worker: true
WebGPU: true
crossOriginIsolated: false
```

This proves browser primitives exist. It does not prove that the model assets can be loaded or that inference can execute.

## Implemented Phase 3 substrate

The following narrow provider abstraction was added:

```text
client/src/lib/embedding/types.ts
client/src/lib/embedding/transformersjs-provider.ts
server/local-embedding-provider.test.ts
```

The provider uses `@huggingface/transformers` with the intended `Xenova/all-MiniLM-L6-v2` feature-extraction architecture, pooled mean embeddings, normalized output, and a configured expected dimension of **384**. Inference is intended to execute locally through Transformers.js and ONNX Runtime Web using the WASM runtime.

The provider exposes:

- `MODEL_NOT_INITIALIZED`;
- `MODEL_LOADING`;
- `MODEL_READY` only after a successful `embed()` call;
- `MODEL_ERROR` with an explicit error message;
- model identity and version metadata;
- runtime metadata;
- configured vector dimension;
- initialization count;
- observable browser Cache API entry counts before and after initialization.

The adapter has no hosted inference fallback. Its test factory is injectable only for deterministic contract tests; it is not used by the production browser path.

## Browser proof result

The actual live-browser attempt imported the real provider and called:

```text
provider.embed("KEIRA local embedding runtime proof.")
```

The attempt reached the Transformers.js/ONNX Runtime Web model-loading path but failed before an embedding was produced:

```text
SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
    at getModelJSON
    at loadConfig
    at _PretrainedConfig.from_pretrained
    at get_model_files
    at get_pipeline_files
    at pipeline
```

A direct browser `fetch()` to the Hugging Face model asset also failed with:

```text
TypeError: Failed to fetch
```

From the sandbox network, the same public model-config URL returned valid JSON, so the model repository itself is available outside the browser preview. The browser failure therefore remains an environment/asset-fetch incompatibility involving the hosted preview’s browser request path, cross-origin policy, or URL fallback. It is not evidence that the model produced a vector.

The browser subsystem then entered a crash-loop protection state while attempting additional console inspection. No further browser execution was performed.

## Tests and what they prove

`server/local-embedding-provider.test.ts` contains four deterministic contract tests:

- lifecycle reaches `MODEL_READY` only after a successful embedding;
- initialization alone remains `MODEL_LOADING`;
- observable cache state is recorded rather than simulated;
- empty input, wrong dimensions, non-finite values, and initialization failure are rejected explicitly;
- no fallback provider is invoked.

These tests use an injected pipeline factory and therefore prove the provider contract only. They do **not** prove that Transformers.js can load or execute the model in the browser.

## Required conclusion

KEIRA **does not yet have a verified browser-local embedding runtime**. The configured 384-dimensional contract is an intended model contract, not observed inference output. `MODEL_READY` was not observed from the real model path, and no vector was produced by the live browser proof.

## Viable next options

1. **Same-origin model asset packaging:** host the exact Transformers.js model configuration, tokenizer, ONNX weights, and required WASM assets from the KEIRA origin; configure `env.localModelPath` and `env.allowRemoteModels = false`, then repeat the browser proof. This is the strongest sovereign/local-runtime option but adds model asset size and deployment complexity.
2. **Explicit asset proxy/CORS configuration:** make the exact model-asset origin reachable from the hosted preview and verify response content types and CORS headers. This would be an asset-download dependency, not a hosted inference API, but it must be accepted as an external model-asset dependency.
3. **Production-origin browser smoke test:** repeat the unchanged provider against the deployed production origin, because the current Vite hosted preview may rewrite or block cross-origin model assets differently from production.

No option was implemented automatically because the directive requires stopping on browser incompatibility rather than silently substituting a hosted service or fabricating a cache hit.

## References

[1]: https://huggingface.co/docs/transformers.js/en/index "Transformers.js browser runtime documentation"
[2]: https://huggingface.co/docs/transformers.js/en/api/env "Transformers.js environment and browser cache documentation"
[3]: https://huggingface.co/Xenova/all-MiniLM-L6-v2 "Xenova all-MiniLM-L6-v2 model card"
[4]: https://huggingface.co/docs/transformers.js/en/api/pipelines "Transformers.js feature-extraction pipeline documentation"
