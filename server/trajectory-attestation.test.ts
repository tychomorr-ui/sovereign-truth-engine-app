import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signTrajectoryHandler, signTrajectoryRoot } from "./trajectory-attestation";

describe("KEIRA trajectory attestation", () => {
  it("signs the exact trajectory root and returns the matching raw public key", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const root = "ab".repeat(32);
    const attestation = signTrajectoryRoot(root, privateKeyPem);
    const valid = verify(null, Buffer.from(root, "utf8"), { key: Buffer.from(`302a300506032b6570032100${attestation.pubkey_hex}`, "hex"), format: "der", type: "spki" }, Buffer.from(attestation.signature_hex, "hex"));

    expect(attestation.signature_hex).toMatch(/^[a-f0-9]{128}$/);
    expect(attestation.pubkey_hex).toMatch(/^[a-f0-9]{64}$/);
    expect(valid).toBe(true);
  });

  it("accepts a PEM whose newlines were serialized as literal backslash-n characters", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const attestation = signTrajectoryRoot("ef".repeat(32), privateKeyPem.replace(/\n/g, "\\n"));
    expect(attestation.signature_hex).toMatch(/^[a-f0-9]{128}$/);
    expect(attestation.pubkey_hex).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed for malformed roots and non-Ed25519 keys", () => {
    const { privateKey: rsaKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const rsaPem = rsaKey.export({ type: "pkcs8", format: "pem" }).toString();
    expect(() => signTrajectoryRoot("not-a-root", rsaPem)).toThrow(/64-character SHA-256/);
    expect(() => signTrajectoryRoot("ab".repeat(32), rsaPem)).toThrow(/Ed25519/);
  });

  it("validates the lightweight signing endpoint contract without exposing private material", () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    let statusCode = 0;
    let body: Record<string, string> | undefined;
    signTrajectoryHandler(
      { body: { trajectory_root_cid: "cd".repeat(32) } } as never,
      {
        status: (code: number) => { statusCode = code; return { json: (value: Record<string, string>) => { body = value; } }; },
        json: (value: Record<string, string>) => { body = value; },
      } as never,
      privateKeyPem,
    );
    expect(statusCode, body?.error ?? "no endpoint error").toBe(200);
    expect(body?.algorithm).toBe("Ed25519");
    expect(body?.signature_hex).toMatch(/^[a-f0-9]{128}$/);
    expect(body?.pubkey_hex).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toContain("PRIVATE KEY");
  });
});
