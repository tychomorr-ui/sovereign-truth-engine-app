import { describe, expect, it } from "vitest";
import { canClaimResetAccount } from "./routers";

describe("authentication reset account guard", () => {
  it("allows only explicitly reset passwordless accounts to reclaim their email", () => {
    expect(canClaimResetAccount({ loginMethod: "auth-reset", passwordHash: null })).toBe(true);
    expect(canClaimResetAccount({ loginMethod: "auth-reset", passwordHash: "hash" })).toBe(false);
    expect(canClaimResetAccount({ loginMethod: "sovereign", passwordHash: null })).toBe(false);
    expect(canClaimResetAccount(null)).toBe(false);
  });
});
