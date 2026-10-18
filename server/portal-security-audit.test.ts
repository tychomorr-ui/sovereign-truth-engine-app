import { describe, expect, it } from "vitest";
import { KEIRA_SECURITY_HEADERS } from "./_core/security-headers";

describe("Portal Security & Sovereignty Audit", () => {
  it("defines anti-framing, restrictive browser capabilities, and a KEIRA content-security policy", () => {
    expect(KEIRA_SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(KEIRA_SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
    expect(KEIRA_SECURITY_HEADERS["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(KEIRA_SECURITY_HEADERS["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(KEIRA_SECURITY_HEADERS["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(KEIRA_SECURITY_HEADERS["Content-Security-Policy"]).toContain("'wasm-unsafe-eval'");
    expect(KEIRA_SECURITY_HEADERS["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
  });
});
