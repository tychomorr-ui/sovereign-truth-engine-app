import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  verify,
} from "node:crypto";

export const KEIRA_IDENTITY_MANIFEST_VERSION = "1.0";
export const KEIRA_IDENTITY_RECEIPT_VERSION = "1.0";

export type KeiraCanonicalManifest = {
  manifest_version: typeof KEIRA_IDENTITY_MANIFEST_VERSION;
  application: {
    id: "keira";
    name: "KEIRA";
    role: "sovereign-local-intelligence-runtime";
  };
  canonical_urls: {
    identity: "/.well-known/keira-identity.json";
    receipt: "/.well-known/keira-receipt.json";
  };
  public_key: {
    algorithm: "Ed25519";
    key_id: string;
    pem: string;
    fingerprint_sha256: string;
  };
  created_at: string;
};

export type KeiraSignedIdentityReceipt = {
  receipt_version: typeof KEIRA_IDENTITY_RECEIPT_VERSION;
  receipt_id: string;
  issued_at: string;
  manifest: KeiraCanonicalManifest;
  canonical_manifest_sha256: string;
  signature: {
    algorithm: "Ed25519";
    encoding: "base64url";
    key_id: string;
    value: string;
  };
};

export type KeiraIdentityVerification = {
  valid: boolean;
  state: "VERIFIED_SELF_ISSUED" | "INVALID";
  reason: string;
  public_key_fingerprint: string | null;
};

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

/**
 * Deterministic JSON encoding for the exact signed bytes. This avoids reliance on
 * incidental insertion order when a manifest is generated or independently verified.
 */
export function canonicalizeJson(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key]!)}`).join(",")}}`;
}

export function sha256Base64Url(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function createKeiraEd25519KeyPair(): { publicKeyPem: string; privateKeyPem: string; fingerprint: string; keyId: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const fingerprint = sha256Base64Url(publicKeyPem);
  return {
    publicKeyPem,
    privateKeyPem,
    fingerprint,
    keyId: `keira-ed25519-${fingerprint.slice(0, 20)}`,
  };
}

export function createKeiraCanonicalManifest(input: {
  publicKeyPem: string;
  keyId: string;
  createdAt?: string;
}): KeiraCanonicalManifest {
  const publicKey = createPublicKey(input.publicKeyPem);
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("KEIRA identity key must be Ed25519.");

  return {
    manifest_version: KEIRA_IDENTITY_MANIFEST_VERSION,
    application: {
      id: "keira",
      name: "KEIRA",
      role: "sovereign-local-intelligence-runtime",
    },
    canonical_urls: {
      identity: "/.well-known/keira-identity.json",
      receipt: "/.well-known/keira-receipt.json",
    },
    public_key: {
      algorithm: "Ed25519",
      key_id: input.keyId,
      pem: input.publicKeyPem,
      fingerprint_sha256: sha256Base64Url(input.publicKeyPem),
    },
    created_at: input.createdAt ?? new Date().toISOString(),
  };
}

function receiptPayload(receipt: Pick<KeiraSignedIdentityReceipt, "receipt_version" | "receipt_id" | "issued_at" | "manifest" | "canonical_manifest_sha256">): CanonicalValue {
  return {
    receipt_version: receipt.receipt_version,
    receipt_id: receipt.receipt_id,
    issued_at: receipt.issued_at,
    manifest: receipt.manifest as unknown as CanonicalValue,
    canonical_manifest_sha256: receipt.canonical_manifest_sha256,
  };
}

export function createKeiraSignedIdentityReceipt(input: {
  manifest: KeiraCanonicalManifest;
  privateKeyPem: string;
  receiptId?: string;
  issuedAt?: string;
}): KeiraSignedIdentityReceipt {
  const privateKey = createPrivateKey(input.privateKeyPem);
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("KEIRA identity signing key must be Ed25519.");

  const canonicalManifest = canonicalizeJson(input.manifest as unknown as CanonicalValue);
  const unsignedReceipt = {
    receipt_version: KEIRA_IDENTITY_RECEIPT_VERSION,
    receipt_id: input.receiptId ?? randomUUID(),
    // MySQL/TiDB timestamp persistence is second-precision in this schema. Signing
    // a millisecond timestamp would make a correctly stored receipt unverifiable on
    // reload, so default to the exact precision the durable record can preserve.
    issued_at: input.issuedAt ?? new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z"),
    manifest: input.manifest,
    canonical_manifest_sha256: sha256Base64Url(canonicalManifest),
  } as const;
  const payload = canonicalizeJson(receiptPayload(unsignedReceipt));
  const signature = sign(null, Buffer.from(payload, "utf8"), privateKey).toString("base64url");

  return {
    ...unsignedReceipt,
    signature: {
      algorithm: "Ed25519",
      encoding: "base64url",
      key_id: input.manifest.public_key.key_id,
      value: signature,
    },
  };
}

export function verifyKeiraSignedIdentityReceipt(receipt: KeiraSignedIdentityReceipt): KeiraIdentityVerification {
  try {
    if (receipt.receipt_version !== KEIRA_IDENTITY_RECEIPT_VERSION) throw new Error("unsupported receipt version");
    if (receipt.manifest.manifest_version !== KEIRA_IDENTITY_MANIFEST_VERSION) throw new Error("unsupported manifest version");
    if (receipt.manifest.application.id !== "keira") throw new Error("manifest is not owned by KEIRA");
    if (receipt.manifest.public_key.algorithm !== "Ed25519" || receipt.signature.algorithm !== "Ed25519") throw new Error("receipt does not use Ed25519");
    if (receipt.signature.encoding !== "base64url") throw new Error("unsupported signature encoding");
    if (receipt.signature.key_id !== receipt.manifest.public_key.key_id) throw new Error("signature key ID does not match manifest key ID");

    const publicKey = createPublicKey(receipt.manifest.public_key.pem);
    if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("manifest public key is not Ed25519");
    const fingerprint = sha256Base64Url(receipt.manifest.public_key.pem);
    if (fingerprint !== receipt.manifest.public_key.fingerprint_sha256) throw new Error("manifest public-key fingerprint mismatch");
    if (!receipt.manifest.public_key.key_id.endsWith(fingerprint.slice(0, 20))) throw new Error("manifest key ID is not bound to the public key");

    const manifestHash = sha256Base64Url(canonicalizeJson(receipt.manifest as unknown as CanonicalValue));
    if (manifestHash !== receipt.canonical_manifest_sha256) throw new Error("canonical manifest hash mismatch");

    const payload = canonicalizeJson(receiptPayload(receipt));
    const validSignature = verify(null, Buffer.from(payload, "utf8"), publicKey, Buffer.from(receipt.signature.value, "base64url"));
    if (!validSignature) throw new Error("Ed25519 signature verification failed");

    return { valid: true, state: "VERIFIED_SELF_ISSUED", reason: "KEIRA canonical manifest and receipt signature verified", public_key_fingerprint: fingerprint };
  } catch (error) {
    return {
      valid: false,
      state: "INVALID",
      reason: error instanceof Error ? error.message : "unknown signature verification failure",
      public_key_fingerprint: null,
    };
  }
}

/** Encrypts a KEIRA-owned PKCS#8 private key before database persistence. */
export function encryptKeiraPrivateKey(privateKeyPem: string, rootSecret: string): string {
  if (!rootSecret) throw new Error("KEIRA identity signing is unavailable because the server root secret is not configured.");
  const key = createHash("sha256").update("keira-identity-encryption-v1\0").update(rootSecret, "utf8").digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(privateKeyPem, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${nonce.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

/** Decrypts only inside the server-side signing path; callers must never return this value. */
export function decryptKeiraPrivateKey(encrypted: string, rootSecret: string): string {
  if (!rootSecret) throw new Error("KEIRA identity signing is unavailable because the server root secret is not configured.");
  const [version, nonceEncoded, tagEncoded, ciphertextEncoded, ...extra] = encrypted.split(".");
  if (version !== "v1" || !nonceEncoded || !tagEncoded || !ciphertextEncoded || extra.length) throw new Error("Malformed KEIRA encrypted private-key record.");
  const key = createHash("sha256").update("keira-identity-encryption-v1\0").update(rootSecret, "utf8").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonceEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
}
