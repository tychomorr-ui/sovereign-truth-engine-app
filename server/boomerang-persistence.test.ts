import { sign } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKeiraEd25519KeyPair } from "./keira-identity";
import { ingestTextDocument } from "../client/src/lib/corpus/ingest";
import { runBoomerangSwarm } from "../client/src/lib/boomerang/swarm";
import type { ManifoldCandidate } from "../client/src/lib/boomerang/types";

const state = vi.hoisted(() => ({
  attestation: { signature_hex: "", pubkey_hex: "", key_id: "" },
  values: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    insert: vi.fn(() => ({ values: state.values })),
  })),
}));

vi.mock("./keira-identity-persistence", () => ({
  signWithKeiraIdentityKey: vi.fn(async () => state.attestation),
}));

import { persistBoomerangTrajectory } from "./boomerang-persistence";

type KeyPair = ReturnType<typeof createKeiraEd25519KeyPair>;

async function resultFixture() {
  const ingestion = await ingestTextDocument({
    filename: "persistence-fixture.md",
    mimeType: "text/markdown",
    source: "persistence-test",
    content: "alpha beta gamma delta epsilon zeta eta theta",
    targetTokens: 2,
    overlapTokens: 0,
  });
  const candidates: ManifoldCandidate[] = ingestion.chunks.map((artifact, index) => ({
    artifact,
    vector: [Math.cos(index), Math.sin(index), 1],
  }));
  return runBoomerangSwarm("query-hash", "corpus-hash", candidates, { maxHops: 4, returnMaxHops: 3 });
}

function configureAttestation(pair: KeyPair, root: string) {
  const publicKeyDer = Buffer.from(pair.publicKeyPem.replace(/-----[^-]+-----|\s/g, ""), "base64");
  state.attestation = {
    signature_hex: sign(null, Buffer.from(root, "utf8"), pair.privateKeyPem).toString("hex"),
    pubkey_hex: publicKeyDer.subarray(-32).toString("hex"),
    key_id: pair.keyId,
  };
}

describe("Boomerang persistence attestation contract", () => {
  beforeEach(() => {
    state.values.mockReset();
    state.values.mockResolvedValue(undefined);
  });

  it("stores a signed result with its key binding and a distinct trajectory ID", async () => {
    const result = await resultFixture();
    const pair = createKeiraEd25519KeyPair();
    configureAttestation(pair, result.merkleRoot);

    const persisted = await persistBoomerangTrajectory(7, result);
    const stored = state.values.mock.calls[0]?.[0] as Record<string, unknown>;
    const storedResult = JSON.parse(String(stored.resultJson)) as Record<string, unknown>;

    expect(persisted.trajectoryId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(persisted.trajectoryId).not.toBe(result.trajectoryId);
    expect(persisted.serverAttestation).toBe("ED25519_ATTESTED");
    expect(persisted.serverKeyId).toBe(pair.keyId);
    expect(stored.keyId).toBe(pair.keyId);
    expect(storedResult.serverKeyId).toBe(pair.keyId);
    expect(storedResult.serverSignatureHex).toBe(state.attestation.signature_hex);
    expect(storedResult.serverPubkeyHex).toBe(state.attestation.pubkey_hex);
    expect(JSON.stringify(storedResult)).not.toContain(pair.privateKeyPem);
  });
});
