import { describe, expect, it } from "vitest";
import {
  canonicalizeJson,
  createKeiraCanonicalManifest,
  createKeiraEd25519KeyPair,
  createKeiraSignedIdentityReceipt,
  decryptKeiraPrivateKey,
  encryptKeiraPrivateKey,
  verifyKeiraSignedIdentityReceipt,
} from "./keira-identity";

describe("KEIRA canonical identity receipt", () => {
  const pair = createKeiraEd25519KeyPair();
  const manifest = createKeiraCanonicalManifest({
    publicKeyPem: pair.publicKeyPem,
    keyId: pair.keyId,
    createdAt: "2026-10-18T19:00:00.000Z",
  });

  it("signs and verifies KEIRA's own canonical manifest with Ed25519", () => {
    const receipt = createKeiraSignedIdentityReceipt({
      manifest,
      privateKeyPem: pair.privateKeyPem,
      receiptId: "00000000-0000-4000-8000-000000000001",
      issuedAt: "2026-10-18T19:01:00.000Z",
    });
    const verification = verifyKeiraSignedIdentityReceipt(receipt);

    expect(receipt.manifest.application.id).toBe("keira");
    expect(receipt.signature.algorithm).toBe("Ed25519");
    expect(receipt.signature.value).not.toContain("PRIVATE");
    expect(verification).toMatchObject({ valid: true, state: "VERIFIED_SELF_ISSUED" });
  });

  it("rejects any manifest alteration after signing", () => {
    const receipt = createKeiraSignedIdentityReceipt({ manifest, privateKeyPem: pair.privateKeyPem });
    const tampered = {
      ...receipt,
      manifest: {
        ...receipt.manifest,
        application: { ...receipt.manifest.application, role: "tampered" },
      },
    };

    expect(verifyKeiraSignedIdentityReceipt(tampered).valid).toBe(false);
  });

  it("binds the key identifier to the manifest public key", () => {
    const receipt = createKeiraSignedIdentityReceipt({ manifest, privateKeyPem: pair.privateKeyPem });
    const tampered = { ...receipt, signature: { ...receipt.signature, key_id: "keira-ed25519-unbound" } };

    expect(verifyKeiraSignedIdentityReceipt(tampered)).toMatchObject({ valid: false, state: "INVALID" });
  });

  it("uses deterministic canonical JSON regardless of object insertion order", () => {
    expect(canonicalizeJson({ z: [3, { b: true, a: null }], a: "value" }))
      .toBe(canonicalizeJson({ a: "value", z: [3, { a: null, b: true }] }));
  });

  it("uses database-safe second precision when generating a receipt timestamp", () => {
    const receipt = createKeiraSignedIdentityReceipt({ manifest, privateKeyPem: pair.privateKeyPem });
    expect(receipt.issued_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
    expect(verifyKeiraSignedIdentityReceipt(receipt).valid).toBe(true);
  });

  it("encrypts KEIRA private keys at rest and does not decrypt with the wrong root secret", () => {
    const rootSecret = "keira-test-root-secret-that-is-long-enough-for-a-unit-test";
    const encrypted = encryptKeiraPrivateKey(pair.privateKeyPem, rootSecret);

    expect(encrypted).not.toContain("BEGIN PRIVATE KEY");
    expect(decryptKeiraPrivateKey(encrypted, rootSecret)).toBe(pair.privateKeyPem);
    expect(() => decryptKeiraPrivateKey(encrypted, "wrong-secret-that-cannot-decrypt-the-keira-key")).toThrow();
  });
});
