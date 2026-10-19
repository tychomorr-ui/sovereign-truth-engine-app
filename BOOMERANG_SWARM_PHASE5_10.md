# Boomerang Swarm — Phases 5–10

## Scope

This milestone completes the remaining Boomerang work after the Phase 1–4 traversal substrate. It does not add mesh transport, remote peers, or external model authority. All navigation remains bounded and uses the local corpus embeddings already proven by KEIRA’s browser runtime.

## Implemented

### Phase 5 — bounded global fusion

`runBoomerangSwarm` now produces a deterministic global fusion ranked by role-weighted local reciprocal-rank contributions and core-agent multipliers. The result is explicitly bounded to the canonical top 30. Ranking ties resolve by artifact CID, and the result commits `{artifact_cid, rank, weighted_rrf_score}` records to a deterministic SHA-256 Merkle root.

### Phase 6 — three-agent orchestration

The swarm launches up to three role-separated agents: `LITERAL`, `CONCEPTUAL`, and `CONTRARIAN`. Each agent has a cryptochrome-derived start vector, bounded outbound traversal, asymmetric return traversal, a digestive pass, and verified Pharo-Lapse-style integrity envelopes. Agent output is data, not authority.

### Phase 7 — real Portal integration

The Portal Chat MIST save action now converts the current conversation into the existing local corpus, ensures local embeddings are available, launches the Boomerang swarm from the current query hash, and renders the persisted result through `BoomerangRadar`. The radar displays real agent hops, coverage, fused ranks, scores, attestation state, and the Merkle root. It does not use mock trajectory data.

### Phase 8 — durable storage

A new additive `keiraBoomerangTrajectories` table stores the complete canonical result JSON, query hash, Merkle root, schema version, creation time, and public attestation metadata. The protected Portal API exposes owner-scoped persist, read, and list procedures. Private key material never enters the browser or result JSON.

### Phase 9 — acceptance coverage

`server/boomerang-phase5-10.test.ts` verifies the top-30 bound, three role identities, deterministic canonical attestation payloads and digests, pending-to-server-attested lifecycle semantics, and fail-closed malformed-result handling. Existing Phase 1–4 tests remain green.

### Phase 10 — canonical execution order

The runtime order is now explicit:

1. Build or retrieve the local corpus and exact embedding candidates.
2. Derive bounded cryptochrome start positions.
3. Traverse outbound and asymmetric return waves.
4. Digest hops into integrity envelopes.
5. Reject tampered envelopes.
6. Apply role/core weighted global fusion and retain top 30.
7. Build the deterministic Merkle root.
8. Persist the result through the protected server boundary.
9. Sign only the Merkle root with KEIRA’s existing durable Ed25519 identity key.
10. Render and expose public verification metadata without exposing private material.

## Evidence

- Phase 1–4 focused suite: 8 tests passed.
- Phase 5–10 focused suite: 3 tests passed.
- TypeScript check: passed.
- Database migration: additive `0017_pale_gorgon.sql`, applied to the hosted database.
- Hosted browser smoke test: passed; the three-agent result persisted with Ed25519 attestation active, 100% agent coverage, one fused artifact, and a displayed Merkle root.
- Storage repair: `0018_complete_fat_cobra.sql` widens `resultJson` to MySQL `LONGTEXT` because full three-agent embedding vectors exceed the 64 KiB `TEXT` limit; migration applied successfully.
- Final release gate: 238 tests passed, 1 expected skip, type-check passed, production build passed, and Drizzle schema check passed.

## Boundaries

The Ed25519 signature is produced server-side through KEIRA’s existing encrypted identity key and is returned only as public signature metadata. Browser-side Boomerang execution remains local and bounded. No claim is made that the swarm is conscious, omniscient, networked, autonomous, or a source of truth. A fused score is a retrieval result, not verified fact or authorization.
