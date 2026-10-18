# KEIRA Corpus Foundation

**Phase:** 2 — browser-local corpus storage
**Status:** Implemented foundation; no MIST retrieval or embedding generation is claimed.

## What Phase 2 implements

- Strongly typed corpus document, chunk, artifact metadata, embedding-record, search, and storage-stat contracts.
- Deterministic local ingestion for operator-provided **Markdown** and **plain text**.
- Unicode/line-ending/whitespace normalization.
- Markdown heading-aware sections.
- Token-aware chunk windows with defaults of **500 tokens** and **50-token overlap**.
- Canonical JSON + Web Crypto SHA-256 source/chunk hashes and `cid:sha256:<hash>` identifiers.
- Browser-local IndexedDB storage with document, chunk, and embedding object stores.
- Document deletion that removes associated chunks and stored embeddings.
- A `CorpusStore` interface so later MIST layers do not couple directly to IndexedDB.
- A deterministic storage-inspection lookup used only to inspect stored chunks; it is not the MIST L1–L7 pipeline.

## Implementation locations

```text
client/src/lib/corpus/types.ts
client/src/lib/corpus/ingest.ts
client/src/lib/storage/interface.ts
client/src/lib/storage/indexeddb-corpus-store.ts
server/corpus-foundation.test.ts
```

## What Phase 2 intentionally does not implement

- PDF parsing or OCR.
- An upload page, corpus management route, or corpus UI.
- Local embedding generation, Transformers.js, LanceDB, semantic search, centroid clustering, Echoes, Patterns, Arcana, fusion, or a MIST trajectory.
- Merkle trajectory attestation, trajectory signing, Phoenix recursion, structured claim verification, or citation rendering.
- Server-side corpus synchronization, remote storage, a vector database, or any hosted inference provider.
- Physical browser storage-size measurement; `storageBytes` remains `null` rather than fabricating a value.

## Persistence and privacy model

The `IndexedDbCorpusStore` is intended to run in the operator's browser. It performs no fetches, remote synchronization, model calls, or background uploads. Source text is normalized and chunked before it is stored. Embedding records have a place in the schema but are not created by Phase 2; the interface exists so a later **local-only** embedding phase can persist model/version provenance alongside vectors.

The automated suite uses `fake-indexeddb` as a **development-only test shim**. It validates the Web API contract in Node but does not prove quota behavior, eviction behavior, or all browser-specific IndexedDB implementation details. Those remain browser acceptance tests for the corpus UI phase.

## Provenance contract

Each chunk retains:

- source document ID and source hash;
- chunk hash and CID;
- document/section/file metadata;
- token range;
- creation timestamp; and
- schema version.

The document hash is based on canonicalized normalized content and canonical metadata. Hashes are reproducible for identical inputs. IDs are content-addressed identifiers, not a claim of IPFS publication or network availability.

## Required validation

```bash
pnpm vitest run server/corpus-foundation.test.ts
pnpm test
pnpm check
pnpm build
git diff --check
```

## Phase 2 verification evidence

- Focused corpus suite: 4 tests passed.
- Full KEIRA suite: 201 tests passed; 1 RDS credential test was intentionally skipped.
- `pnpm check` passed.
- Production build passed.
- The existing Vite client-chunk-size warning remains; Phase 2 did not increase the emitted client bundle module count.

## Next compatible phase

Phase 3 should prove a browser-compatible local embedding runtime and cache behavior in isolation. Do not connect embeddings to MIST, the active chat flow, or remote providers until that compatibility proof passes.
