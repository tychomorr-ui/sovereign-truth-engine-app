import { createDeterministicReceipt, listDeterministicCapabilities, type DeterministicCapability, type DeterministicResult } from "./deterministic-core";

export type DeterministicOperation = { capability: DeterministicCapability; input: unknown };

export function resolveDeterministicCapability(capability: string): DeterministicResult<{ capability: DeterministicCapability }> {
  if (!listDeterministicCapabilities().includes(capability as DeterministicCapability)) {
    return { ok: false, failure: "CAPABILITY_UNAVAILABLE", receipt: createDeterministicReceipt("capability_discovery", `capability ${capability} is unavailable`, "CAPABILITY_UNAVAILABLE") };
  }
  return { ok: true, value: { capability: capability as DeterministicCapability }, receipt: createDeterministicReceipt("capability_discovery", `capability ${capability} is available in the deterministic bus`, "PROVEN") };
}

export function routeDeterministic<T>(operation: DeterministicOperation, handler: (input: unknown) => DeterministicResult<T>): DeterministicResult<T> {
  const capability = resolveDeterministicCapability(operation.capability);
  if (!capability.ok) return capability as DeterministicResult<T>;
  const result = handler(operation.input);
  return result;
}
