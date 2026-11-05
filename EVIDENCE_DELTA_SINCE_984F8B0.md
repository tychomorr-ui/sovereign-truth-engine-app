# Evidence Delta Since `984f8b0`

**Baseline:** KEIRA reconciliation commit `984f8b0`
**Delta date:** 2026-11-04
**Authority:** Executed isolated staging proof; claims are not upgraded beyond the evidence described here.

## Changed claims

| Claim | Old status | New status | Evidence | Source | Confidence | Remaining gap |
|---|---|---|---|---|---|---|
| VALKYRIE / Gate 5A source exists | `UNKNOWN` | `VERIFIED_FROM_GIT` for source existence; `VERIFIED_FROM_TEST` for the isolated Gate 5A path | Recovered implementation at `536368b`; single-use challenge fix at isolated commit `906e22b`; focused suite and two-process restart proof passed | `tychomorr-ui/XINUS-Tesseract-A@536368b`; isolated staging `906e22b` | High for the tested isolated behavior | No production deployment or cross-node operation is proven |
| Gate 5A challenge, authorization, signature, receipt, replay, restart, and challenge-consumption portions | `DOCUMENTED_BUT_UNVERIFIED` / `VERIFIED_WITH_GAPS` | `VERIFIED_FROM_TEST` in isolated staging | 22 focused tests passed; valid signed request completed; receipt verified; durable request state survived process restart; identical replay returned `DUPLICATE`; a distinct valid request reusing the consumed challenge returned `FAILED / REPLAY`; tamper and expiry were rejected; fetch trap was not called | Two-process worker proof against shared temporary state; `GATE5A_PROCESS_RESTART_PROOF_536368B.md` | High for isolated staging | Full repository suite has unrelated missing-table failures; production readiness remains unestablished |
| Tesseract evidence lineage | `DOCUMENTED_BUT_UNVERIFIED` / `STALE` | `PARTIALLY_VERIFIED` as separate evidence lineages | Gate 5A fix was committed only in the fresh detached staging clone; existing checkout was not modified | Existing checkout `95065d9`; recovered source `536368b`; isolated fix `906e22b` | High for separation claim | The two lineages have not been deliberately reconciled |

## Unchanged claims

These remain at the prior status because the Gate 5A proof did not test them:

- Monarch-OS runtime: `UNKNOWN` beyond repository existence.
- Root Sovereign Gateway staging source: `DOCUMENTED` / runtime and authority unproven.
- ATMOS integration: `UNKNOWN`.
- ARCHANGEL integration or control-plane authority: `UNKNOWN`.
- Live Pharo-Lapse transport, peer registry, replay protection across nodes, acknowledgements, and store-and-forward: `DOCUMENTED_BUT_UNVERIFIED` or `UNKNOWN` beyond KEIRA-local envelope integrity.
- Clarity, IWA, and Resonate relationships: `UNKNOWN`.
- Authenticated hosted KEIRA execution: `UNKNOWN` / unavailable because the current login path remains broken.
- Any cross-node signed operation: not authorized and not proven.
- Production deployment readiness: not established.

## Full-suite limitation

The isolated Gate 5A focused suite passed, but the broader recovered repository suite was not clean: 59 test files passed, 2 were skipped, and 3 database-backed files failed because unrelated tables were absent, including `valkyrie_federated_mode`, `lex_primordialis`, `erebus_7_protocol`, `adjudication_cases`, `truth_coin_ledger`, and `valkyrie_nodes`. No schema mutation was performed. This limitation does not invalidate the focused Gate 5A proof, but it prevents claiming a clean repository-wide regression result.

## Interpretation rule

A repository or commit can establish source existence and a code lineage. A focused isolated test can establish the behavior it actually exercises. Neither establishes a live runtime, production readiness, authority relationship, key possession, or successful cross-node operation.

## Gate 5A process-restart proof update

The completed two-process staging proof is classified `VERIFIED_FROM_TEST` for the isolated Gate 5A implementation after the single-use challenge fix. A valid `REFRESH_SIGNED_STATUS` completed before restart; its signed receipt verified; request state persisted; a second worker recognized the prior request as `DUPLICATE`; a distinct valid request reusing the original challenge was rejected as `FAILED / REPLAY`; tampered and expired authorization were rejected; and the network trap was not triggered.

No production endpoint, database, credential, private key, deployment, or existing Tesseract checkout was modified or contacted. See `GATE5A_PROCESS_RESTART_PROOF_536368B.md`.
