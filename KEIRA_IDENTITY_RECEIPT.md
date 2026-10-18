# KEIRA Canonical Identity and Signed Receipt

## Scope

KEIRA owns its **own** canonical identity manifest and its **own** Ed25519 keypair. This feature does not import, reuse, derive, or request an ARCHANGEL private key. ARCHANGEL may independently fetch KEIRA's public `.well-known` documents and verify them, but it is not KEIRA's signer.

## Canonical documents

After an authorized KEIRA administrator issues a receipt, the hosted application exposes:

- `/.well-known/keira-identity.json` — KEIRA's public manifest, public key, key fingerprint, and verification state.
- `/.well-known/keira-receipt.json` — KEIRA's signed receipt and verification state.

Both are intentionally public-safe. Neither exposes the private key, encrypted key record, application root secret, user memory, model configuration, access tokens, or conversation content.

## Key lifecycle

1. An authenticated KEIRA administrator invokes the owner-only `portal.chat.issueKeiraIdentityReceipt` operation with `confirm: true`.
2. If KEIRA has no active identity key, the server generates exactly one Ed25519 keypair within the KEIRA server process.
3. The public key is embedded in the KEIRA canonical manifest. Its SHA-256 public-key fingerprint determines the key ID.
4. The private key is encrypted using AES-256-GCM under `KEIRA_IDENTITY_ROOT_SECRET`, a dedicated KEIRA server root secret, before persistence. It is never returned, logged, embedded in a manifest, or placed in frontend code.
5. KEIRA signs a deterministic canonical JSON receipt payload using Ed25519.
6. KEIRA immediately verifies the signature and the manifest/hash/key-ID bindings, persists the receipt, then reloads and verifies the exact durable record before reporting it as `RECEIPT_ACTIVE`.

`GET` endpoints do not create keys or issue receipts. Before administrative issuance they return `RECEIPT_PENDING`; failed validation is `RECEIPT_INVALID`.

## What a receipt proves

A `VERIFIED_SELF_ISSUED` receipt proves only that:

- A KEIRA-owned Ed25519 private key signed the exact canonical manifest displayed with the receipt.
- The attached public key verifies that signature.
- The manifest's public-key fingerprint and key ID are internally consistent.

It does **not** prove that any external control plane, third party, domain registrar, government, distributed ledger, model, memory item, operator claim, or runtime capability independently attests to KEIRA. It is a cryptographic integrity and origin statement—not an authority grant or truth claim.

## Verification algorithm

An independent verifier reconstructs the canonical receipt payload by recursively sorting JSON object keys and encoding it with standard JSON scalar syntax. It then:

1. validates the receipt and manifest versions;
2. validates `application.id === "keira"`;
3. validates Ed25519 algorithms and base64url signature encoding;
4. recomputes the PEM SHA-256 fingerprint and verifies the public-key-bound key ID;
5. recomputes the canonical manifest hash; and
6. verifies the Ed25519 signature using the manifest's public key.

Any failed step results in `INVALID`, never an active receipt. Issuance uses storage-safe, second-precision timestamps because the receipt persistence schema stores timestamps at that precision; this prevents a database round-trip from altering signed bytes.

## Operational boundary

Key rotation and third-party attestations are not implemented in this initial release. Do not manually edit the identity tables, mutate published manifest fields, or change the server root secret after issuance without a migration plan, because doing so can invalidate access to the encrypted private key or create conflicting provenance. Rotation must be implemented as an explicit, receipt-backed operation before use.
