# Evidence Delta Since `984f8b0`

**Baseline:** KEIRA reconciliation commit `984f8b0`  
**Delta date:** 2026-11-02  
**Authority:** Supplied evidence directive; claims are not upgraded beyond the evidence described there.

## Changed claims

| Claim | Old status | New status | Evidence | Source | Confidence | Remaining gap |
|---|---|---|---|---|---|---|
| VALKYRIE / Gate 5A source exists | `UNKNOWN` | `VERIFIED_FROM_GIT` for source existence; `PARTIALLY_VERIFIED` for implementation behavior | Gate 5A implementation and `REFRESH_SIGNED_STATUS` are reported at commit `536368b`; staging E2E is reported `VERIFIED_WITH_GAPS` | `tychomorr-ui/XINUS-Tesseract-A@536368b` | Medium-high for source/commit claim; medium for behavior until independently rerun | Process-restart persistence/recovery is not proven; production readiness is not established |
| Gate 5A challenge/authorization/signature/receipt/replay portions | `UNKNOWN` | `DOCUMENTED_BUT_UNVERIFIED` from KEIRA’s perspective, with supplied staging result `VERIFIED_WITH_GAPS` | Bounded challenge lifecycle, operator authorization, signed evidence, signed receipt, replay handling, and durable-state design are reported as verified portions | Supplied staging E2E result for `XINUS-Tesseract-A@536368b` | Medium | KEIRA has not independently reproduced the staging E2E; restart proof remains open |
| Tesseract evidence lineage | `DOCUMENTED_BUT_UNVERIFIED` / `STALE` | `PARTIALLY_VERIFIED` as separate evidence lineages | Canonical local checkout is reported at `95065d9` with uncommitted manifest edits; recovered Gate 5A source is separate at `536368b` | Tesseract checkout `95065d9`; recovered source `536368b` | Medium | The two lineages have not been deliberately reconciled; the older checkout must not be modified |
| Monarch-OS repository existence | `UNKNOWN` | `VERIFIED_FROM_GIT` for repository existence; runtime remains `UNKNOWN` | A real GitHub repository is reported to exist | `tychomorr-ui/XINUS-Monarch_OS` | Medium | Repository has not been cloned and independently audited; no runtime capability follows |
| Root Sovereign Gateway staging source | No prior KEIRA claim | `VERIFIED_FROM_GIT` for repository existence; `DOCUMENTED` for staging source | Repository reportedly contains an Express server and Project Reclaim-related record structures | `tychomorr-ui/root-sovereign-gateway-staging` | Medium | Live Project Reclaim node, identity, deployment, and authority are not proven |
| Cryptochrometer/Witness v4 / DAWN recovery | `UNKNOWN` / unresolved historical | `UNRECOVERED` | Searches reportedly did not recover the described v4 / DAWN artifacts from accessible GitHub, local filesystem, or USB | `NEXINUS_CRYPTOCHROMETER_STATE/v4`, `DAWN` claims | High for current non-recovery statement | No recreation is authorized; the three-phase observation model remains the defensible model |

## Unchanged claims

These remain at the `984f8b0` status because no new evidence was supplied:

- ATMOS integration: `UNKNOWN`.
- ARCHANGEL integration or control-plane authority: `UNKNOWN`.
- Live Pharo-Lapse transport, peer registry, replay protection, acknowledgements, and store-and-forward: `DOCUMENTED_BUT_UNVERIFIED` or `UNKNOWN` beyond KEIRA-local envelope integrity.
- Clarity, IWA, and Resonate relationships: `UNKNOWN`.
- Authenticated hosted KEIRA execution: `UNKNOWN` / unavailable because the current login path remains broken.
- Any cross-node signed operation: not authorized and not proven.

## Interpretation rule

A repository or commit can establish source existence and a code lineage. It cannot, by itself, establish a live runtime, production readiness, authority relationship, endpoint contract, key possession, or successful cross-node operation.

## Gate 5A process-restart proof update

The separate-process restart proof was executed against `XINUS-Tesseract-A@536368b` in isolated staging. A valid `REFRESH_SIGNED_STATUS` completed before restart; its signed receipt verified; request state persisted; a second worker recognized the prior request as `DUPLICATE`; tampered and expired authorization were rejected; and the network trap was not triggered.

The overall Gate 5A status remains `VERIFIED_WITH_GAPS`, not `VERIFIED_FROM_TEST`, because a newly signed request using the original challenge was accepted after restart. Challenge reuse therefore remains an open security failure. No production readiness claim is made. See `GATE5A_PROCESS_RESTART_PROOF_536368B.md`.
