import type { Request, Response } from "express";
import { ENV } from "./_core/env";

/**
 * Public-safe operational health only. This handler never returns the secret, its
 * length, a hash, or any private-key material. It merely confirms whether KEIRA can
 * safely encrypt a generated Ed25519 private identity key at rest.
 */
export function getKeiraIdentityRootSecretHealth(): {
  application: "KEIRA";
  identity_key_encryption: "READY" | "NOT_CONFIGURED";
  minimum_secret_length: number;
} {
  return {
    application: "KEIRA",
    identity_key_encryption: ENV.keiraIdentityRootSecret.length >= 32 ? "READY" : "NOT_CONFIGURED",
    minimum_secret_length: 32,
  };
}

export function keiraIdentityRootSecretHealthHandler(_req: Request, res: Response): void {
  const health = getKeiraIdentityRootSecretHealth();
  res.status(health.identity_key_encryption === "READY" ? 200 : 503).json(health);
}
