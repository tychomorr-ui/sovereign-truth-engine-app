# Boomerang Swarm v2 — Phase 1

**Status:** Implemented as a deterministic, browser-local traversal substrate wrapped around the existing MIST v1 engine. MIST itself was not reordered or modified.

## Implemented

- Typed `SwarmAgentState` with explicit `LAUNCH`, `TRAVERSING`, `COMPLETE`, and `BLOCKED` phases.
- `manifoldHop(currentPosition, candidates)` selection using:
  - cosine similarity from the current position;
  - local curvature as normalized neighbor density;
  - traversal score = similarity × local curvature;
  - deterministic CID tie-breaking.
- Bounded traversal with configurable `maxHops` and `coverageThreshold`.
- Duplicate-CID and malformed-vector rejection.
- Deterministic visited-CID and hop accounting.
- Three role labels (`LITERAL`, `CONCEPTUAL`, `CONTRARIAN`) are represented in state, while role-specific cryptochrome offsets remain intentionally deferred.

## Evidence

`server/boomerang-phase1.test.ts` covers curvature-driven selection, threshold termination, deterministic repeatability, three distinct supplied starting paths, duplicate rejection, and invalid bounds.

## Not implemented in Phase 1

The following remain outside this boundary and must not be inferred as complete:

- Cryptochrome Navigation Hash derivation from a Root-Gate signature.
- Synthetic return vectors and asymmetric return traversal.
- Local digestive dedup/RRF/core-peripheral tagging.
- Pharo-Lapse envelope signing and verification.
- Three-agent orchestration beyond the reusable single-agent state machine.
- Global weighted fusion, Merkle commitment, and Ed25519 signing.
- Database persistence, audit-export extension, and Orbital Radar UI.

These deferred capabilities will be implemented only in their stated later phases with independent tests and provenance boundaries.
