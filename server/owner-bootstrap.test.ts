import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): { ctx: TrpcContext; cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> } {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.ownerBootstrap", () => {
  it("fails closed until a new account is explicitly created", async () => {
    const token = process.env.PORTAL_OWNER_ACCESS_TOKEN;
    expect(token).toBeTruthy();

    const { ctx, cookies } = createContext();
    await expect(appRouter.createCaller(ctx).auth.ownerBootstrap({ token: token! })).rejects.toThrow("Owner account is not provisioned.");
    expect(cookies).toHaveLength(0);
  });
});
