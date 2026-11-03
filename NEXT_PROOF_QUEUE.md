# Next Proof Queue

**Purpose:** Reduce uncertainty with the smallest reproducible proofs, in dependency order.  
**Constraint:** No deployment, production mutation, private-key import, or privileged cross-node action is authorized by this queue.

## 1. Gate 5A process-restart proof — highest priority

**Question:** Does the Gate 5A implementation survive and recover correctly across a real process restart?

**Required evidence:** A reproducible test using `XINUS-Tesseract-A@536368b` that starts from a clean state, completes the bounded challenge/authorization/signature/receipt flow, stops the process, restarts it, and verifies durable state, replay handling, and receipt continuity.

**Pass condition:** The same state and security invariants are recovered after restart without recreating authority from an untrusted client.

**Current status:** `UNKNOWN`; supplied staging result remains `VERIFIED_WITH_GAPS`.

## 2. Tesseract / VALKYRIE evidence alignment

**Question:** Are the `95065d9` Tesseract checkout and `536368b` recovered Gate 5A source the same intended lineage, compatible lineages, or divergent artifacts?

**Required evidence:** Read-only commit ancestry, manifest comparison, canonical identity/key IDs, Gate 5A test fixtures, and explicit mapping of changed files. Do not modify or reset the `95065d9` checkout.

**Pass condition:** A written lineage mapping identifies which source is authoritative for each claim and preserves uncommitted edits.

**Current status:** `PARTIALLY_VERIFIED`.

## 3. Reconcile KEIRA to the common evidence/receipt model

**Question:** Can KEIRA consume and verify Gate 5A evidence without becoming an authority issuer?

**Required evidence:** A versioned, read-only adapter contract for evidence and receipts; public-key/key-ID binding; explicit status mapping; tests for valid, stale, replayed, malformed, and restart-recovered receipts.

**Pass condition:** KEIRA can observe, correlate, classify, and explain Gate 5A state while rejecting unverifiable authority claims.

**Current status:** `ARCHITECTURAL`; no adapter is authorized yet.

## 4. Clone and audit Monarch-OS

**Question:** What does `tychomorr-ui/XINUS-Monarch_OS` actually implement?

**Required evidence:** Read-only clone, commit history, build/test result, runtime entrypoint, identity/receipt behavior, and explicit gap report.

**Pass condition:** Capabilities are classified from source and tests, not repository existence.

**Current status:** Repository existence `VERIFIED_FROM_GIT`; runtime `UNKNOWN`.

## 5. Re-establish live Pharo-Lapse evidence

**Question:** Does a bounded transport actually provide signed recipient verification, deduplication, replay protection, forwarding integrity, acknowledgements, and bounded routing?

**Required evidence:** Versioned transport contract, test fixtures, key IDs, two controlled endpoints or test peers, and a reproducible message trace. Do not claim store-and-forward without a restart/offline delivery test.

**Pass condition:** The full trace is independently verifiable and does not grant arbitrary execution authority.

**Current status:** KEIRA-local envelope integrity `VERIFIED_FROM_CODE`; live transport `UNKNOWN`.

## 6. Only then consider a bounded cross-node signed operation

**Preconditions:** Gate 5A restart proof passes; Tesseract/VALKYRIE lineages are reconciled; KEIRA adapter is versioned and tested; Monarch-OS and transport are audited; public keys, authorization scope, replay rules, and receipts are available.

**Allowed shape:** One narrow, non-destructive, operator-authorized operation with explicit proposal, authorization, execution, verification, and receipt stages.

**Current status:** Not authorized and not proposed as an executable action.
