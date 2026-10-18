# KEIRA Phase 3 — Browser-Local Embedding Proof

**Status:** **VERIFIED — same-origin browser-local embedding execution passed.**

Phase 3 remains intentionally limited to the embedding runtime substrate and its compatibility proof. No MIST layer, Corpus UI, PDF parser, Ollama integration, LLM response generation, trajectory attestation, Phoenix recursion, server embedding API, database schema, or hosted inference fallback was added.

## Implemented runtime

KEIRA now uses `@huggingface/transformers` 4.3.1 with `Xenova/all-MiniLM-L6-v2` and ONNX Runtime Web/WASM. The exact model revision is pinned to:

```text
751bff37182d3f1213fa05d7196b954e230abad9
```

The browser provider is implemented in:

```text
client/src/lib/embedding/types.ts
client/src/lib/embedding/transformersjs-provider.ts
server/local-embedding-provider.test.ts
```

The provider exposes explicit `MODEL_NOT_INITIALIZED`, `MODEL_LOADING`, `MODEL_READY`, and `MODEL_ERROR` states. `MODEL_READY` is set only after a real embedding call returns a finite vector with the expected dimension of **384**. There is no hosted inference fallback.

## Same-origin asset packaging

Large assets are not committed to `client/public`. They are uploaded through the WebDev lifecycle-managed storage path and served through KEIRA's same-origin `/manus-storage/{key}` proxy. The proxy streams bytes from the storage backend rather than redirecting the browser to a cross-origin signed URL. It preserves content type, content length, range responses, and immutable caching headers.

The allow-listed model files are:

```text
config.json
 tokenizer.json
tokenizer_config.json
special_tokens_map.json
vocab.txt
onnx/model_quantized.onnx
```

The ONNX Runtime WASM files are also served same-origin:

```text
ort-wasm-simd-threaded.asyncify.mjs
ort-wasm-simd-threaded.asyncify.wasm
```

Transformers.js is configured with `env.allowRemoteModels = false`, an explicit local model path, an allow-listed fetch map, and same-origin ONNX WASM paths. Non-allow-listed model URLs fail closed.

The browser CSP includes only `'wasm-unsafe-eval'` for WebAssembly compilation; it does not enable unrestricted `'unsafe-eval'`.

## Browser proof

The proof executed the real provider in Chromium against the live HTTPS KEIRA preview. It loaded the model configuration, tokenizer, ONNX weights, ONNX Runtime WASM module, and WASM binary from same-origin paths, then executed:

```text
provider.embed("KEIRA same-origin local embedding proof.")
```

Observed result:

```json
{
  "model": "Xenova/all-MiniLM-L6-v2",
  "modelVersion": "onnx-feature-extraction-384@751bff37182d3f1213fa05d7196b954e230abad9",
  "runtime": "wasm",
  "status": "MODEL_READY",
  "initializationCount": 1,
  "cacheStatus": "CACHE_OBSERVED_AFTER_LOAD",
  "cacheEntriesBeforeLoad": 0,
  "cacheEntriesAfterLoad": 4,
  "vectorLength": 384,
  "finite": true,
  "l2Norm": 0.9999998525869208
}
```

This is an actual browser-produced vector, not a mock pipeline result or a simulated cache claim. The observed vector was normalized and finite. The cache observation confirms that the browser cache received four model/runtime resources during initialization.

## Corpus integration addendum

The verified provider is now connected to KEIRA's browser-local IndexedDB `CorpusStore` through `LocalCorpusSimilarityService`. A second live browser proof indexed two Markdown chunks, persisted two model/version-bound 384-dimensional vectors, and ranked a `river water current` query by local cosine similarity: the `River` section scored `0.6947328116336847`; `Mountain` scored `0.06366552331276928`. This adds direct local semantic retrieval only; it is not MIST retrieval or Portal Chat augmentation.

## Tests and release evidence

The deterministic provider contract suite contains four tests covering lifecycle, cache observation, dimension validation, non-finite rejection, empty input, initialization failure, and no-fallback behavior. The security audit suite additionally asserts that the CSP permits `'wasm-unsafe-eval'` without permitting `'unsafe-eval'`.

The focused provider tests, storage-proxy tests, TypeScript check, full regression suite, Drizzle migration check, and production build all passed after the completed storage-proxy and WASM changes. The final regression result was **207 passed, 1 expected skip** across 44 passing test files and 1 skipped file.

## Boundaries

This proof establishes browser-local embedding execution for the pinned MiniLM model in the hosted preview. It does not establish:

- offline inference after a browser restart;
- browser quota/eviction behavior;
- production-origin behavior;
- corpus ingestion-to-embedding integration;
- MIST retrieval or claim verification;
- local LLM generation through Ollama, llama.cpp, or vLLM;
- trajectory signing or Phoenix recursion.

Those remain separate, testable phases. The next authorized phase may integrate this verified provider with the existing browser-local `CorpusStore`; it must not silently add MIST or replace Portal Chat.

## References

[1]: https://huggingface.co/docs/transformers.js/en/index "Transformers.js browser runtime documentation"
[2]: https://huggingface.co/docs/transformers.js/en/api/env "Transformers.js environment and browser cache documentation"
[3]: https://huggingface.co/Xenova/all-MiniLM-L6-v2 "Xenova all-MiniLM-L6-v2 model card"
[4]: https://huggingface.co/docs/transformers.js/en/api/pipelines "Transformers.js feature-extraction pipeline documentation"
