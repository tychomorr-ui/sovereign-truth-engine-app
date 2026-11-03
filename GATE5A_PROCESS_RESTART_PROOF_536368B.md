# Gate 5A Process-Restart Proof

**Classification:** `VERIFIED_WITH_GAPS`  
**Scope:** isolated staging only  
**KEIRA evidence baseline preserved:** `59d5ea2`  
**Recovered source:** `tychomorr-ui/XINUS-Tesseract-A` at commit `536368b1527839df78269f9388a81125b07027a4`

## Repository and isolation

The proof used a fresh detached clone at:

`/tmp/keira-gate5a-proof-1793666692/repo`

The existing local Tesseract checkout was not opened or modified. `tesseract-sovereign` was not pulled, overwritten, deployed, or contacted. State was written only beneath the temporary proof directory:

`/tmp/gate5a-restart-proof.UYYQWg/state`

The source checkout remained clean at the tested commit.

## Implementation exercised

The proof exercised the actual implementation in:

- `server/valkyrie-gate5a-staging.ts`
- `shared/valkyrie-gate5a.ts`
- `server/atmos-manifest.ts`

The existing repository runner and tests were also inspected:

- `scripts/gate5a-e2e.ts`
- `server/valkyrie-gate5a-staging.test.ts`

The existing runner does not perform a process restart; its report explicitly identified that gap. Therefore, a temporary external worker was used only as a test driver. It did not modify repository source.

## Commands

Dependencies were installed in the fresh clone with:

```text
pnpm install --frozen-lockfile
```

The actual restart proof ran two independent worker processes against the same temporary filesystem state directory:

```text
pnpm exec tsx /tmp/gate5a-proof-worker.mts first /tmp/gate5a-restart-proof.UYYQWg
pnpm exec tsx /tmp/gate5a-proof-worker.mts after /tmp/gate5a-restart-proof.UYYQWg
```

The recovered focused suite also ran:

```text
pnpm vitest run server/valkyrie-gate5a-staging.test.ts
pnpm check
```

Results: 21 focused tests passed; TypeScript validation passed.

## Results

| Proof requirement | Result | Evidence |
|---|---|---|
| Valid bounded `REFRESH_SIGNED_STATUS` accepted | `PASS` | Pre-restart worker returned `COMPLETED` for `VALKYRIE-STAGING` / `GATE_5A_STAGING` |
| Signed receipt produced and verified | `PASS` | Pre-restart result returned `receiptVerified: true`; receipt outcome was `COMPLETED` |
| Request/replay state durably persisted | `PASS` | State directory contained challenge JSON plus request `dispatch.json` and `record.json` files |
| Process terminated and restarted | `PASS` | Pre-restart worker PID `244514` exited; post-restart worker PID `244580` started against the same state directory |
| Previously accepted request remains replay | `PASS` | Post-restart replay returned `DUPLICATE` with outcome `COMPLETED` |
| Challenge reuse rejected | `FAIL` | A new valid request using the original challenge returned `COMPLETED`; `reusedChallengeCode` was `null` |
| Tampered authorization rejected | `PASS` | Tampered dispatch signature returned `FAILED` / `SIGNATURE_INVALID` |
| Expired authorization rejected | `PASS` | Expired dispatch returned `EXPIRED` / `EXPIRED` |
| No production contact | `PASS` | Runtime `fetch` trap was not called; implementation scan found no fetch, HTTP client, socket, subprocess, SSH, shell, firewall, or command-execution capability |
| No unrestricted execution path | `PASS` | Gate 5A implementation imports only local crypto, filesystem, path, Express types, and local schema/types |

## Pre-restart result

The first isolated worker accepted a freshly challenged and signed request, produced a cryptographically verified receipt, and persisted the lifecycle. The request ID was `restart-proof-1793666779820-lhogq5hld4k`; the challenge ID was `2550afe7-2c75-4896-83d0-4310c175a720`.

## Restart event

The first worker terminated normally after writing durable state. A second independently started worker loaded the same state directory. No service manager, deployment, production process, or external node was restarted.

## Post-restart and replay result

The second worker recognized the original request as `DUPLICATE`. This proves process-restart recovery of the persisted request record and replay decision.

## Challenge-reuse result

The second worker created a distinct, correctly signed request using the original challenge ID. The implementation accepted it as `COMPLETED`. This fails the explicit requirement that a challenge be single-use or otherwise rejected on reuse. The existing source validates challenge identity and expiry but does not persist or enforce a consumed-challenge state.

This is the blocking gap. The implementation was not modified to make the test pass.

## Authorization/tamper result

A tampered dispatch signature was rejected with `SIGNATURE_INVALID`. An expired dispatch was rejected with `EXPIRED`. The focused suite additionally passed unknown-challenge, request-hash, evidence-signature, stale-evidence, target, scope, manifest, and code-hash rejection cases.

## Safety and handling status

No production endpoint, production database, production key, DNS route, or external node was contacted by the Gate 5A proof. The temporary worker generated ephemeral staging Ed25519 keys solely for the isolated test; private-key contents were not printed, inspected, committed, imported, or added to the evidence artifacts. Only public test results and filesystem paths were recorded.

The temporary driver used subprocesses to create the required isolated process boundary. That was test orchestration outside the Gate 5A implementation; the Gate 5A path itself exposes no shell, SSH, arbitrary subprocess, firewall, network mutation, unrestricted command, or external HTTP capability.

## Final classification

`VERIFIED_WITH_GAPS`

The separate process-restart and durable replay proof actually executed and passed. Full Gate 5A verification is not established because challenge reuse was accepted rather than rejected. Gate 5A must not be classified as production-ready on the basis of this run.
