import { createPrivateKey, createPublicKey, sign, type KeyObject } from "node:crypto";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";

const ROOT_HEX_PATTERN = /^[a-f0-9]{64}$/i;

function normalizePrivateKeyMaterial(value: string): string | { key: Buffer; format: "der"; type: "pkcs8" } {
  const unquoted = value.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").replace(/\\n/g, "\n");
  const pemMatch = unquoted.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (pemMatch) return `-----BEGIN PRIVATE KEY-----\n${pemMatch[1].replace(/\s+/g, "")}\n-----END PRIVATE KEY-----`;
  const compactBase64 = unquoted.replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=_-]+$/.test(compactBase64)) return { key: Buffer.from(compactBase64, "base64"), format: "der", type: "pkcs8" };
  return unquoted;
}

function publicKeyHex(privateKey: KeyObject): string {
  const publicKey = createPublicKey(privateKey);
  if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("KEIRA_PRIVATE_KEY must contain an Ed25519 private key.");
  const spki = publicKey.export({ type: "spki", format: "der" });
  return spki.subarray(-32).toString("hex");
}

export function signTrajectoryRoot(trajectoryRootCid: string, privateKeyPem = ENV.keiraPrivateKey): { signature_hex: string; pubkey_hex: string } {
  if (!ROOT_HEX_PATTERN.test(trajectoryRootCid)) throw new Error("trajectory_root_cid must be a 64-character SHA-256 hex root.");
  if (!privateKeyPem) throw new Error("KEIRA trajectory signing is unavailable because KEIRA_PRIVATE_KEY is not configured.");
  const privateKey = createPrivateKey(normalizePrivateKeyMaterial(privateKeyPem));
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("KEIRA_PRIVATE_KEY must contain an Ed25519 private key.");
  return {
    signature_hex: sign(null, Buffer.from(trajectoryRootCid, "utf8"), privateKey).toString("hex"),
    pubkey_hex: publicKeyHex(privateKey),
  };
}

export function signTrajectoryHandler(req: Request, res: Response, privateKeyPem = ENV.keiraPrivateKey): void {
  const trajectoryRootCid = typeof req.body?.trajectory_root_cid === "string" ? req.body.trajectory_root_cid.trim() : "";
  try {
    const signed = signTrajectoryRoot(trajectoryRootCid, privateKeyPem);
    res.status(200).json({
      algorithm: "Ed25519",
      encoding: "hex",
      trajectory_root_cid: trajectoryRootCid,
      ...signed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trajectory signing failed.";
    const status = message.includes("not configured") ? 503 : 400;
    res.status(status).json({ error: message });
  }
}
