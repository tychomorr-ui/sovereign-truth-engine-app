import { sha256Hex } from "../corpus/ingest";
import type { SwarmAgentRole } from "./types";

function roleSign(role: SwarmAgentRole): number {
  return role === "CONTRARIAN" ? -1 : 1;
}

/**
 * Derives a deterministic local navigation vector from an observed root-gate
 * signature. This is an input-bound seed, not an authority claim and not a
 * network or hardware attestation.
 */
export async function deriveCryptochromeStartPosition(
  rootGateSignature: string,
  agentId: string,
  role: SwarmAgentRole,
  dimension: number,
): Promise<number[]> {
  if (!rootGateSignature.trim()) throw new Error("A root-gate signature is required for cryptochrome derivation.");
  if (!agentId.trim()) throw new Error("An agent ID is required for cryptochrome derivation.");
  if (!Number.isInteger(dimension) || dimension < 1) throw new Error("Cryptochrome dimension must be a positive integer.");
  const seed = await sha256Hex(`PHARO-LAPSE-CRYPTOCHROME/1|${rootGateSignature}|${agentId}|${role}`);
  const values: number[] = [];
  for (let index = 0; index < dimension; index += 1) {
    const byte = Number.parseInt(seed.slice((index * 2) % seed.length, ((index * 2) % seed.length) + 2), 16);
    values.push(roleSign(role) * ((byte / 255) * 2 - 1));
  }
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0));
  if (magnitude === 0) throw new Error("Cryptochrome derivation produced a zero vector.");
  return values.map((value) => value / magnitude);
}
