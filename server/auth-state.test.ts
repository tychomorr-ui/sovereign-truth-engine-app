import { describe, expect, it } from "vitest";
import { hasPrivilegedAuthentication, resolveAuthenticationState } from "./auth-state";

describe("KEIRA authentication state contract", () => {
  it("distinguishes unauthenticated and temporary beta access", () => {
    expect(resolveAuthenticationState({ user: null })).toBe("UNAUTHENTICATED");
    expect(resolveAuthenticationState({ user: null, betaSession: true })).toBe("BETA_SESSION");
    expect(hasPrivilegedAuthentication("BETA_SESSION")).toBe(false);
  });

  it("recognizes sovereign users without promoting ordinary users", () => {
    expect(resolveAuthenticationState({ user: { role: "user", loginMethod: "sovereign" } })).toBe("SOVEREIGN_AUTHENTICATED");
    expect(hasPrivilegedAuthentication("SOVEREIGN_AUTHENTICATED")).toBe(false);
  });

  it("distinguishes explicit owner authentication from database-admin authentication", () => {
    expect(resolveAuthenticationState({ user: { role: "user", loginMethod: "sovereign" }, ownerAuthenticated: true })).toBe("OWNER_AUTHENTICATED");
    expect(resolveAuthenticationState({ user: { role: "admin", loginMethod: "sovereign" } })).toBe("ADMIN_AUTHENTICATED");
    expect(hasPrivilegedAuthentication("OWNER_AUTHENTICATED")).toBe(true);
    expect(hasPrivilegedAuthentication("ADMIN_AUTHENTICATED")).toBe(true);
  });
});
