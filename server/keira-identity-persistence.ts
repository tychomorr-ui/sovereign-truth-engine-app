import { and, desc, eq, isNull } from "drizzle-orm";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import {
  createKeiraCanonicalManifest,
  createKeiraEd25519KeyPair,
  createKeiraSignedIdentityReceipt,
  decryptKeiraPrivateKey,
  encryptKeiraPrivateKey,
  verifyKeiraSignedIdentityReceipt,
  type KeiraCanonicalManifest,
  type KeiraSignedIdentityReceipt,
} from "./keira-identity";
import { keiraIdentityKeys, keiraIdentityReceipts, type KeiraIdentityKey } from "../drizzle/schema";

export type KeiraPublicIdentityStatus = {
  status: "RECEIPT_ACTIVE" | "RECEIPT_PENDING" | "RECEIPT_INVALID";
  manifest: KeiraCanonicalManifest | null;
  receipt: KeiraSignedIdentityReceipt | null;
  verification: ReturnType<typeof verifyKeiraSignedIdentityReceipt> | null;
  reason: string;
};

function requireIdentityRootSecret(): string {
  if (!ENV.keiraIdentityRootSecret || ENV.keiraIdentityRootSecret.length < 32) {
    throw new Error("KEIRA identity signing requires a dedicated KEIRA identity root secret of at least 32 characters.");
  }
  return ENV.keiraIdentityRootSecret;
}

async function activeKey(): Promise<KeiraIdentityKey | undefined> {
  const db = await getDb();
  if (!db) throw new Error("KEIRA identity persistence is unavailable: database is not configured.");
  const rows = await db
    .select()
    .from(keiraIdentityKeys)
    .where(isNull(keiraIdentityKeys.retiredAt))
    .orderBy(desc(keiraIdentityKeys.createdAt))
    .limit(1);
  return rows[0];
}

/** Creates KEIRA's one application-owned Ed25519 identity only when none is active. */
export async function getOrCreateKeiraIdentityKey(): Promise<KeiraIdentityKey> {
  const existing = await activeKey();
  if (existing) return existing;

  const db = await getDb();
  if (!db) throw new Error("KEIRA identity persistence is unavailable: database is not configured.");
  const rootSecret = requireIdentityRootSecret();
  const pair = createKeiraEd25519KeyPair();
  const createdAt = new Date();
  const candidate = {
    keyId: pair.keyId,
    algorithm: "Ed25519",
    publicKeyPem: pair.publicKeyPem,
    publicKeyFingerprint: pair.fingerprint,
    encryptedPrivateKey: encryptKeiraPrivateKey(pair.privateKeyPem, rootSecret),
    createdAt,
    retiredAt: null,
  } as const;

  try {
    await db.insert(keiraIdentityKeys).values(candidate);
    return candidate;
  } catch (error) {
    // Another authorized request may have created the key concurrently. Do not create
    // a competing KEIRA identity; reload the active record before surfacing an error.
    const winner = await activeKey();
    if (winner) return winner;
    throw error;
  }
}

function manifestForKey(key: KeiraIdentityKey): KeiraCanonicalManifest {
  return createKeiraCanonicalManifest({
    publicKeyPem: key.publicKeyPem,
    keyId: key.keyId,
    createdAt: key.createdAt.toISOString(),
  });
}

function receiptFromRow(row: typeof keiraIdentityReceipts.$inferSelect): KeiraSignedIdentityReceipt {
  const manifest = JSON.parse(row.manifestJson) as KeiraCanonicalManifest;
  return {
    receipt_version: "1.0",
    receipt_id: row.receiptId,
    issued_at: row.issuedAt.toISOString(),
    manifest,
    canonical_manifest_sha256: row.canonicalManifestSha256,
    signature: {
      algorithm: "Ed25519",
      encoding: "base64url",
      key_id: row.keyId,
      value: row.signature,
    },
  };
}

/**
 * Produces KEIRA's self-issued canonical identity receipt. The private key is read,
 * decrypted, and used only in this server-side function; it is never returned or logged.
 */
export async function issueKeiraIdentityReceipt(): Promise<KeiraPublicIdentityStatus> {
  const key = await getOrCreateKeiraIdentityKey();
  const rootSecret = requireIdentityRootSecret();
  const manifest = manifestForKey(key);
  const privateKeyPem = decryptKeiraPrivateKey(key.encryptedPrivateKey, rootSecret);
  const receipt = createKeiraSignedIdentityReceipt({ manifest, privateKeyPem });
  const verification = verifyKeiraSignedIdentityReceipt(receipt);
  if (!verification.valid) {
    return { status: "RECEIPT_INVALID", manifest, receipt: null, verification, reason: verification.reason };
  }

  const db = await getDb();
  if (!db) throw new Error("KEIRA identity persistence is unavailable: database is not configured.");
  await db.insert(keiraIdentityReceipts).values({
    receiptId: receipt.receipt_id,
    keyId: receipt.signature.key_id,
    manifestJson: JSON.stringify(receipt.manifest),
    canonicalManifestSha256: receipt.canonical_manifest_sha256,
    signature: receipt.signature.value,
    verificationState: verification.state,
    issuedAt: new Date(receipt.issued_at),
  });

  // Verify the reloaded durable representation, not only the in-memory object. This
  // catches storage transformations (such as timestamp-precision changes) before a
  // receipt can be reported as active.
  const storedRows = await db
    .select()
    .from(keiraIdentityReceipts)
    .where(eq(keiraIdentityReceipts.receiptId, receipt.receipt_id))
    .limit(1);
  const stored = storedRows[0];
  if (!stored) throw new Error("KEIRA identity receipt could not be reloaded after persistence.");
  const durableReceipt = receiptFromRow(stored);
  const durableVerification = verifyKeiraSignedIdentityReceipt(durableReceipt);
  if (!durableVerification.valid) {
    await db
      .update(keiraIdentityReceipts)
      .set({ verificationState: "INVALID_AFTER_PERSISTENCE" })
      .where(eq(keiraIdentityReceipts.receiptId, receipt.receipt_id));
    return {
      status: "RECEIPT_INVALID",
      manifest,
      receipt: null,
      verification: durableVerification,
      reason: `KEIRA persisted receipt verification failed: ${durableVerification.reason}`,
    };
  }

  return {
    status: "RECEIPT_ACTIVE",
    manifest,
    receipt: durableReceipt,
    verification: durableVerification,
    reason: "KEIRA's own canonical manifest was signed, persisted, and verified with KEIRA's Ed25519 key.",
  };
}

/** Returns a public-safe representation. It never generates a key or receipt on a GET. */
export async function getKeiraPublicIdentityStatus(): Promise<KeiraPublicIdentityStatus> {
  const key = await activeKey();
  if (!key) {
    return {
      status: "RECEIPT_PENDING",
      manifest: null,
      receipt: null,
      verification: null,
      reason: "KEIRA identity has not been issued by an authorized operator.",
    };
  }

  const db = await getDb();
  if (!db) throw new Error("KEIRA identity persistence is unavailable: database is not configured.");
  const rows = await db
    .select()
    .from(keiraIdentityReceipts)
    .where(and(eq(keiraIdentityReceipts.keyId, key.keyId), eq(keiraIdentityReceipts.verificationState, "VERIFIED_SELF_ISSUED")))
    .orderBy(desc(keiraIdentityReceipts.issuedAt))
    .limit(1);
  const manifest = manifestForKey(key);
  const row = rows[0];
  if (!row) {
    return {
      status: "RECEIPT_PENDING",
      manifest,
      receipt: null,
      verification: null,
      reason: "KEIRA public key exists, but no verified self-issued receipt has been recorded.",
    };
  }

  const receipt = receiptFromRow(row);
  const verification = verifyKeiraSignedIdentityReceipt(receipt);
  return {
    status: verification.valid ? "RECEIPT_ACTIVE" : "RECEIPT_INVALID",
    manifest,
    receipt: verification.valid ? receipt : null,
    verification,
    reason: verification.valid ? "KEIRA signed receipt verified from the stored public manifest." : verification.reason,
  };
}
