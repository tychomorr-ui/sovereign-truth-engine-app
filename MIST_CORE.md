# KEIRA Phase 4 — Deterministic MIST Retrieval Core

**Status:** Implemented as a browser-local deterministic retrieval library. No UI, chat integration, local LLM generation, Phoenix recursion, Merkle attestation, or signature is included in this phase.

## Core result contract

Every retrieval returns a typed `MistResult` with the required layer payloads:

```text
MISTResult {
  lexical,
  semantic,
  centroid,
  echoes,
  patterns,
  arcana,
  fusion,
  trajectoryArtifacts
}
```

It additionally includes the normalized and SHA-256-hashed query, an explicit status, and local embedding-indexing metadata. Layer results are always explicit: `EXECUTED`, `EMPTY`, or `UNAVAILABLE`. A retrieval is `COMPLETE`, `PARTIAL`, or `EMPTY_CORPUS`; no layer silently fabricates success.

## Implemented layers

| Layer | Deterministic behavior |
|---|---|
| L1 Lexical | Unicode-aware normalized exact-token overlap: `intersection(queryTokens, artifactTokens) / queryTokens`. Top 20. |
| L2 Semantic | Uses only `LocalCorpusSimilarityService`, the configured local embedding provider, and exact model/version-bound IndexedDB vectors. Top 20. |
| L3 Centroid | Deterministic k-means style clustering over L2 vectors, `k = min(3, candidates)`, farthest-point deterministic seeds, deterministic tie-breaks, 12-iteration maximum. Each cluster emits its centroid and closest representative. |
| L4 Echoes | For each L3 centroid, selects up to 3 farthest semantic artifacts that still have cosine similarity `> 0.6`. It retains centroid ID, representative CID, similarity, distance, and layer score. |
| L5 Patterns | Scores cross-cluster bridge candidates using `similarity(A) + similarity(B) + min(similarity(A), similarity(B))`. The second-best centroid similarity must be at least `0.2`. |
| L6 Arcana | Searches only artifact metadata fields—not source content—including source, filename, title, section, tags, author, timestamp, role, scope, and keywords. Top 20. |
| L7 RRF Fusion | Fuses L1–L6 artifact rankings with `RRF(d) = Σ 1 / (60 + rank)`. Top 30, deterministic score/CID ordering. |

## Provenance and failure boundaries

- MIST depends only on the `CorpusStore` interface and the provider-neutral `EmbeddingProvider` interface.
- L2 accepts only vectors matching the active exact model name, model version, expected dimension, and finite-value invariant.
- Empty corpus requests return an empty trajectory without initializing the embedding provider.
- Embedding failure returns an explicit `PARTIAL` result: L1 and L6 may still report their deterministic evidence, while L2–L5 are `UNAVAILABLE`. No hosted provider or lexical stand-in is substituted for semantic retrieval.
- `trajectoryArtifacts` are ranked fusion artifacts with CIDs, layer memberships, individual layer scores, RRF score, and rank. They are not Merkle-attested or signed in Phase 4.

## Files

```text
client/src/lib/mist/types.ts
client/src/lib/mist/core.ts
server/mist-core.test.ts
MIST_CORE.md
```

## Deferred work

- Corpus upload/UI and Portal Chat retrieval integration.
- MIST trajectory persistence, Merkle root, Ed25519 attestation, and receipt integration.
- Structured claims, deterministic evidence-span verification, local LLM synthesis, and Phoenix recursion.
- Hybrid/reranking algorithms, learned optimization, remote vector stores, and all hosted inference providers.

## Live browser proof

The hosted HTTPS preview ran the actual browser-local MiniLM/WASM provider with IndexedDB storage through `MistCore`. A four-document Markdown corpus was indexed into four 384-dimensional vectors. The retrieval query `local governance evidence pattern` returned `COMPLETE` with every layer executed:

```text
L1 lexical:   3 candidates
L2 semantic:  4 candidates
L3 centroid:  3 clusters
L4 echoes:    2 candidates
L5 patterns:  4 candidates
L6 arcana:    2 candidates
L7 fusion:    4 trajectory artifacts, RRF constant 60
```

The provider finished `MODEL_READY` with the pinned `Xenova/all-MiniLM-L6-v2` model, 384 dimensions, `runtime: wasm`, and observed browser cache presence. The top fusion artifact was the Bridge section, with layers `L1`, `L2`, `L4`, `L5`, and `L6`. This verifies that MIST core uses actual local vectors and persistent browser corpus data, not mocks or hosted inference.

The final release gate passed with **212 tests passed and 1 expected skip**, plus TypeScript, Drizzle schema consistency, production build, and Git whitespace checks.

## Required validation

```bash
pnpm vitest run server/mist-core.test.ts
pnpm test
pnpm check
pnpm build
git diff --check
```
