import express from "express";
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betaOpenStatusHandler } from "./beta-open-status";

let server: ReturnType<typeof createServer>;
let baseUrl = "";

describe("temporary KEIRA beta-open mode", () => {
  beforeAll(async () => {
    const app = express();
    app.get("/api/beta-status", betaOpenStatusHandler);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server address unavailable");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("reports normal authentication without exposing any secret or owner privilege", async () => {
    const response = await fetch(`${baseUrl}/api/beta-status`);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      betaOpen: false,
      authentication: "normal-authentication",
      ownerPrivileges: false,
    });
    expect(JSON.stringify(body)).not.toContain("BETA_OPEN_MODE");
  });
});
