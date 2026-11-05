# Gate 5A Process-Restart Proof

**Classification:** `VERIFIED_FROM_TEST`
**Scope:** isolated staging only
**KEIRA evidence baseline preserved:** `59d5ea2`
**Recovered source baseline:** `tychomorr-ui/XINUS-Tesseract-A@536368b1527839df78269f9388a81125b07027a4`
**Single-use fix commit:** isolated staging commit `906e22b`

## Repository and isolation

The proof used a fresh detached clone at:

`/tmp/keira-gate5a-proof-1793666692/repo`

The existing local Tesseract checkout was not opened or modified. `tesseract-sovereign` was not pulled, overwritten, deployed, or contacted. State was written only beneath a temporary proof directory:

`/tmp/gate5a-restart-proof-fixed.BwfPqx`

The source fix was committed only in the isolated staging clone as `906e22b`; it was not pushed or deployed.

## Implementation exercised

The proof exercised the actual implementation in:

- `server/valkyrie-gate5a-staging.ts`
- `shared/valkyrie-gate5a.ts`
- `server/atmos-manifest.ts`

The single-use correction adds an atomic filesystem claim at:

`challenges/<challengeId>.consumed/record.json`

The directory is created with exclusive `mkdir`; a second request using the same challenge receives `REPLAY`. The request replay check remains separate, so the identical request remains `DUPLICATE`.

The external worker was only a test driver and did not modify repository source.

## Commands and results

Dependencies were installed in the fresh clone with:

```text
pnpm install --frozen-lockfile
```

Focused validation after the fix:

```text
pnpm vitest run server/valkyrie-gate5a-staging.test.ts
pnpm check
git diff --check
```

Result: **22 focused tests passed; TypeScript validation passed.**

Two independent worker processes then ran against one shared temporary state directory:

```text
pnpm exec tsx /tmp/gate5a-proof-worker.mts first /tmp/gate5a-restart-proof-fixed.BwfPqx
pnpm exec tsx /tmp/gate5a-proof-worker.mts after /tmp/gate5a-restart-proof-fixed.BwfPqx
```

## Restart-proof results

| Proof requirement | Result | Evidence |
|---|---|---|
| Valid bounded `REFRESH_SIGNED_STATUS` accepted | `PASS` | Pre-restart worker returned `COMPLETED` |
| Signed receipt produced and verified | `PASS` | Pre-restart result returned `receiptVerified: true` and `receiptOutcome: COMPLETED` |
| Request/replay state durably persisted | `PASS` | Shared state contained challenge JSON, request `dispatch.json`, request `record.json`, and consumed marker files |
| Process terminated and restarted | `PASS` | Pre-restart PID `245470` exited; post-restart PID `245538` started against the same state directory |
| Previously accepted identical request remains replay | `PASS` | Post-restart replay returned `DUPLICATE` / `COMPLETED` |
| New valid request reusing consumed challenge rejected | `PASS` | Post-restart result returned `FAILED` / `REPLAY` |
| Challenge reuse is atomically single-use | `PASS` | Consumed marker directory was created with exclusive `mkdir`; reuse cannot claim it again |
| Tampered authorization rejected | `PASS` | Tampered dispatch returned `FAILED` / `SIGNATURE_INVALID` |
| Expired authorization rejected | `PASS` | Expired dispatch returned `EXPIRED` / `EXPIRED` |
| No production contact | `PASS` | Runtime fetch trap was not called; no external node was contacted |
| No unrestricted execution path | `PASS` | Gate 5A path exposes no shell, SSH, arbitrary subprocess, firewall, network mutation, unrestricted command, or external HTTP capability |

## Post-restart output

The actual post-restart proof output was:

```text
replayStatus=DUPLICATE
replayOutcome=COMPLETED
reusedChallengeStatus=FAILED
reusedChallengeCode=REPLAY
tamperedStatus=FAILED
tamperedCode=SIGNATURE_INVALID
expiredStatus=EXPIRED
expiredCode=EXPIRED
networkTrapStatus=DUPLICATE
fetchCalled=false
```

The state directory contained:

```text
challenges/<challengeId>.json
challenges/<challengeId>.consumed/record.json
requests/<requestId>/dispatch.json
requests/<requestId>/record.json
```

## Full repository suite limitation

The complete repository command was also attempted:

```text
pnpm test
```

It produced **59 passed test files, 2 skipped test files, and 3 failed test files; 297 passed tests, 3 skipped tests, and 10 failed tests**. The failures were unrelated database-backed VALKYRIE tests reporting missing tables such as `valkyrie_federated_mode`, `lex_primordialis`, `erebus_7_protocol`, `adjudication_cases`, `truth_coin_ledger`, and `valkyrie_nodes`. No schema mutation was performed to mask those failures. The focused Gate 5A suite and restart proof passed independently.

## Safety and handling status

No production endpoint, production database, production key, DNS route, or external node was contacted. The temporary worker generated ephemeral staging Ed25519 keys solely for the isolated test; private-key contents were not printed, inspected, committed, imported, or added to the evidence artifacts. Only public test results and filesystem paths were recorded.

The temporary driver used subprocesses to create the required isolated process boundary. That orchestration was outside the Gate 5A implementation; the Gate 5A path itself exposes no shell, SSH, arbitrary subprocess, firewall, network mutation, unrestricted command, or external HTTP capability.

## Final classification

`VERIFIED_FROM_TEST`

The isolated Gate 5A process-restart proof executed and passed after the single-use challenge fix. The proof demonstrates durable request replay recognition, atomic challenge consumption, signed receipt verification, tamper/expiry rejection, and no production contact. This classification applies only to the isolated staging behavior tested here; it does **not** establish production deployment readiness, cross-node authority, or a clean repository-wide test suite.
