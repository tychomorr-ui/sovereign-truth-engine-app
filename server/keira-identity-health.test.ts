import express from "express";
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keiraIdentityRootSecretHealthHandler } from "./keira-identity-health";

let server: ReturnType<typeof createServer>;
let baseUrl = "";

describe("KEIRA identity root-secret health endpoint", () => {
  beforeAll(async () => {
    const app = express();
    app.get("/api/keira-identity/health", keiraIdentityRootSecretHealthHandler);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server address unavailable");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("reports secure identity-key encryption readiness without disclosing the supplied secret", async () => {
    const response = await fetch(`${baseUrl}/api/keira-identity/health`);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      application: "KEIRA",
      identity_key_encryption: "READY",
      minimum_secret_length: 32,
    });
    expect(JSON.stringify(body)).not.toContain("KEIRA_IDENTITY_ROOT_SECRET");
  });
});
