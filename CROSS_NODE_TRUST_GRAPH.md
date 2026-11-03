# Cross-Node Trust Graph

**Baseline:** `984f8b0` plus the supplied evidence delta  
**Rule:** No relationship is inferred from naming or architecture alone. Only asserted relationships are listed; omitted relationships remain `UNKNOWN`.

## Nodes

| Node | Current status | Evidence boundary |
|---|---|---|
| ATMOS | `UNKNOWN` | No local implementation or independently verified endpoint in KEIRA evidence |
| ARCHANGEL | `UNKNOWN` | No bounded adapter, signed command exchange, or live control-plane proof in KEIRA evidence |
| Pharo-Lapse | `DOCUMENTED` | KEIRA contains local envelope/integrity concepts; network transport is not proven |
| Tesseract | `PARTIALLY_VERIFIED` | Separate local checkout lineage at `95065d9` and recovered Gate 5A source lineage at `536368b`; not reconciled |
| VALKYRIE | `PARTIALLY_VERIFIED` | Gate 5A restart/replay proof passed in isolated staging; challenge reuse was accepted, so authorization lifecycle remains incomplete |
| KEIRA | `VERIFIED` locally | Current repository proves local deterministic, MIST, Boomerang, receipt, and attestation surfaces |
| Monarch-OS | `DOCUMENTED` | Repository existence supplied; source/runtime audit pending |
| Project Reclaim | `DOCUMENTED` | Staging gateway repository evidence only; live node not proven |
| Cryptochrometer / Witness | `UNRECOVERED` | v4 / DAWN artifacts not recovered; three-phase observation model remains defensible |
| Clarity | `UNKNOWN` | No new evidence in the delta |
| IWA | `UNKNOWN` | No new evidence in the delta |
| Resonate | `UNKNOWN` | No new evidence in the delta |

## Asserted relationships

| From | Relationship | To | Status | Evidence and boundary |
|---|---|---|---|---|
| KEIRA | local envelope/integrity compatibility reference | Pharo-Lapse | `DOCUMENTED` | KEIRA Boomerang modules use a `PharoLapseEnvelope` shape and canonical integrity checks; no network delivery proof |
| Tesseract evidence lineage `95065d9` | separate local lineage from | recovered Gate 5A source `536368b` | `PARTIALLY_VERIFIED` | Supplied directive explicitly identifies separate lineages; no merge/reconciliation performed |
| VALKYRIE | Gate 5A implementation is present in | recovered source `536368b` | `PARTIALLY_VERIFIED` | Source and staging E2E are supplied; process-restart recovery remains unproven |
| KEIRA | local evidence/receipt comparison target | VALKYRIE / Gate 5A | `DOCUMENTED` | The directive requests alignment, but no authenticated adapter or shared receipt verification has been demonstrated |
| Monarch-OS | repository exists as | GitHub source | `VERIFIED` | Repository existence is supplied as `VERIFIED_FROM_GIT`; runtime is not inferred |
| Root Sovereign Gateway | staging source contains Project Reclaim-related structures | Project Reclaim | `DOCUMENTED` | Supplied repository description only; no live node proof |
| Cryptochrometer / Witness | historical claim not recovered for | `NEXINUS_CRYPTOCHROMETER_STATE/v4` / `DAWN` | `UNRECOVERED` | Search non-recovery is evidence of absence from searched locations, not proof of nonexistence |
| KEIRA | local identity/attestation boundary is distinct from | ATMOS | `UNKNOWN` | KEIRA’s Ed25519 identity does not establish ATMOS membership or trust-root equivalence |
| ARCHANGEL | governance relationship to KEIRA | KEIRA | `UNKNOWN` | No signed control-plane request, authorization contract, or live exchange supplied |
| ATMOS | identity/evidence relationship to KEIRA | KEIRA | `UNKNOWN` | No manifest binding, key registry, or independently verified node record supplied |

## Explicitly absent edges

No evidence currently establishes any of the following edges:

- ARCHANGEL → arbitrary KEIRA execution.
- ATMOS → KEIRA trust or membership.
- Pharo-Lapse → live multihop, store-and-forward, peer registry, or acknowledgement path.
- Monarch-OS → KEIRA, Tesseract, ARCHANGEL, or Project Reclaim runtime integration.
- Project Reclaim → live root authority.
- Cryptochrometer/Witness → authority, authorization, or signing.
- Clarity, IWA, or Resonate → any of the named nodes.

These edges remain `UNKNOWN`, not `FALSE`.
