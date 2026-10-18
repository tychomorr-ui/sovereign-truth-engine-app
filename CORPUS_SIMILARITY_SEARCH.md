# KEIRA Local Corpus Similarity Search

**Phase:** 3.5 — browser-local embedding/index integration
**Status:** Implemented and test-covered; not MIST.

## Scope

This phase connects the verified browser-local `TransformersJsEmbeddingProvider` contract to the existing browser-local IndexedDB `CorpusStore`.

The new `LocalCorpusSimilarityService`:

1. reads persisted corpus chunks from the storage abstraction;
2. generates vectors through the configured local embedding provider;
3. stores vectors with exact model and model-version provenance;
4. reuses only embeddings that match the active exact model/version pair and expected vector dimension;
5. ranks compatible chunk vectors by deterministic cosine similarity; and
6. returns `semantic_similarity` results sorted by score descending, then chunk CID as a deterministic tie-break.

It does not make network calls itself, fall back to lexical search, invoke a remote vector database, change Portal Chat, or create any MIST/trajectory state.

## Storage and provenance rules

Embeddings remain local IndexedDB records keyed by chunk CID. Each record contains:

- `chunkCid` binding it to an immutable source chunk;
- `model` and `modelVersion` provenance;
- the generated numeric vector;
- creation time; and
- corpus schema version.

A stored vector is eligible only if its model, model version, dimension, and every value match the active provider contract. Vectors from another model/version are excluded rather than compared. Empty queries, non-finite vectors, wrong dimensions, zero-norm vectors, and a provider that has not reached `MODEL_READY` fail closed.

## Implemented files

```text
client/src/lib/corpus/local-similarity.ts
client/src/lib/corpus/types.ts
client/src/lib/storage/interface.ts
client/src/lib/storage/indexeddb-corpus-store.ts
server/corpus-similarity.test.ts
```

## Explicit limitations

- The service runs only when called by a future browser corpus workflow; no corpus UI or chat retrieval hook is added here.
- It does not prove browser restart/offline cache persistence, quota/eviction behavior, or bulk-index performance.
- It does not implement MIST layers, hybrid lexical/semantic fusion, reranking, citations, claims, attestation, or Phoenix recursion.
- It does not use the server local-LLM adapter and does not establish live Ollama/llama.cpp/vLLM availability.

## Live browser proof

The hosted HTTPS preview executed the actual `TransformersJsEmbeddingProvider` with the pinned MiniLM model and the `IndexedDbCorpusStore`. A two-chunk Markdown corpus was indexed in the browser, creating two persisted 384-dimensional embeddings. A local cosine query for `river water current` returned the `River` section first with score `0.6947328116336847`, followed by the `Mountain` section with score `0.06366552331276928`.

Observed runtime metadata was `MODEL_READY`, `runtime: wasm`, `initializationCount: 1`, and `CACHE_OBSERVED_AFTER_LOAD`. The index result reported two scanned and two indexed chunks; IndexedDB stats reported one document, two chunks, and two embeddings. This is evidence of real browser-local vector generation, persistence, and similarity ranking—not a mocked provider result.

The release gate passed with **209 tests passed and 1 expected skip**, plus TypeScript, Drizzle schema consistency, production build, and Git whitespace checks.

## Required validation

```bash
pnpm vitest run server/corpus-similarity.test.ts
pnpm test
pnpm check
pnpm build
git diff --check
```
