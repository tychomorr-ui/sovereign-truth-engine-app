import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasProvisionedOwnerOrAdmin: vi.fn(),
  getUserByEmail: vi.fn(),
  promoteUserToOwner: vi.fn(),
  createSessionToken: vi.fn(),
  isValidOwnerAccessToken: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  hasProvisionedOwnerOrAdmin: mocks.hasProvisionedOwnerOrAdmin,
  getUserByEmail: mocks.getUserByEmail,
  promoteUserToOwner: mocks.promoteUserToOwner,
}));
vi.mock("./sovereign-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sovereign-auth")>()),
  createSessionToken: mocks.createSessionToken,
  isValidOwnerAccessToken: mocks.isValidOwnerAccessToken,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): { ctx: TrpcContext; cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> } {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.ownerBootstrap", () => {
  it("allows explicit bootstrap only when no owner or admin is provisioned", async () => {
    mocks.isValidOwnerAccessToken.mockReturnValue(true);
    mocks.hasProvisionedOwnerOrAdmin.mockResolvedValue(false);
    mocks.getUserByEmail.mockResolvedValue({ id: 2, name: "Tyler Morris", role: "user" });
    mocks.promoteUserToOwner.mockResolvedValue({ id: 2, name: "Tyler Morris", role: "admin" });
    mocks.createSessionToken.mockResolvedValue("session-token");

    const { ctx, cookies } = createContext();
    const result = await appRouter.createCaller(ctx).auth.ownerBootstrap({ token: "valid-token" });

    expect(result).toMatchObject({ id: 2, role: "admin" });
    expect(cookies).toHaveLength(1);
    expect(mocks.promoteUserToOwner).toHaveBeenCalledWith(2);
  });

  it("fails closed and issues no session when an owner or admin already exists", async () => {
    mocks.isValidOwnerAccessToken.mockReturnValue(true);
    mocks.hasProvisionedOwnerOrAdmin.mockResolvedValue(true);
    mocks.getUserByEmail.mockReset();
    mocks.promoteUserToOwner.mockReset();

    const { ctx, cookies } = createContext();
    await expect(appRouter.createCaller(ctx).auth.ownerBootstrap({ token: "valid-token" })).rejects.toThrow("Owner bootstrap is closed");

    expect(cookies).toHaveLength(0);
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    expect(mocks.promoteUserToOwner).not.toHaveBeenCalled();
  });
});
