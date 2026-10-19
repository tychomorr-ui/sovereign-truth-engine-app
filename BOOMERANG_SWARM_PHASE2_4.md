# Boomerang Swarm v2 — Phases 2–4

## Implemented

KEIRA now derives three deterministic agent starting vectors from an operator-supplied root-gate signature, agent ID, and role. The derivation is SHA-256 based and role-aware; it is explicitly an input-derived navigation seed, not a hardware, identity, or authority attestation.

Each agent performs bounded outbound manifold traversal and then an asymmetric return wave. The return vector is a weighted mean of the agent’s highest-scoring outbound landings. Return traversal excludes all outbound CIDs, preventing path re-entry, and remains bounded by its own hop limit.

The digestive pass deduplicates artifact CIDs, calculates local reciprocal-rank contribution across the agent’s complete haul, marks the top 20 percent as core, and emits a Pharolapse-style integrity envelope for each unique artifact. The envelope signature is a deterministic SHA-256 integrity digest over canonical fields. Tampering is rejected locally.

The swarm orchestrator runs up to three agents—literal, conceptual, and contrarian—verifies all local envelopes, applies role weights and core multipliers, ranks the global fusion deterministically, and computes a Merkle root over the fused artifact/rank/score records.

## Pharolapse alignment

The implementation was checked against `tychomorr-ui/pharo-lapse`, especially its canonical JSON rules, route-history and bounded-hop principles, deterministic cryptochrome heading behavior, and distinction between integrity/CID material and Ed25519 signatures. KEIRA does not copy Pharolapse’s Python transport, queues, peer registry, or network delivery layer into the browser runtime.

## Evidence

`server/boomerang-phase1.test.ts` and `server/boomerang-phase234.test.ts` cover deterministic manifold selection, bounded traversal, cryptochrome repeatability, role distinction, asymmetric non-reentry, digestive deduplication, core tagging, envelope tamper rejection, three-agent orchestration, weighted fusion, and stable Merkle roots. Focused Phase 1–4 tests and TypeScript validation pass.

## Explicitly deferred

The envelopes currently provide SHA-256 integrity only. Server-side Ed25519 attestation must use KEIRA’s existing durable identity signer and should be added only when the swarm result is connected to an auditable export or receipt boundary. Database persistence, UI visualizer wiring, live mesh transport, durable Pharo-Lapse queues, peer-registry validation, and network-level route forwarding are not claimed by these phases.
