import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { KEIRA_SECURITY_HEADERS } from "./security-headers";
import { getKeiraPublicIdentityStatus } from "../keira-identity-persistence";
import { keiraIdentityRootSecretHealthHandler } from "../keira-identity-health";
import { betaOpenStatusHandler } from "../beta-open-status";
import { registerStorageProxy } from "./storageProxy";
import { signTrajectoryHandler } from "../trajectory-attestation";
import { streamPortalMessage } from "../portal-chat-stream";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    for (const [name, value] of Object.entries(KEIRA_SECURITY_HEADERS)) {
      res.setHeader(name, value);
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  app.get("/api/beta-status", betaOpenStatusHandler);
  app.get("/api/keira-identity/health", keiraIdentityRootSecretHealthHandler);
  app.post("/api/keira/sign-trajectory", (req, res) => signTrajectoryHandler(req, res));
  app.post("/api/portal/chat/stream", async (req, res) => {
    const context = await createContext({ req, res, info: { isBatchCall: false } as any });
    if (!context.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const conversationId = Number(req.body?.conversationId);
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!Number.isInteger(conversationId) || conversationId < 1 || !message) {
      res.status(400).json({ error: "conversationId and message are required." });
      return;
    }
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const writeEvent = (event: string, payload: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    try {
      const result = await streamPortalMessage(context.user.id, conversationId, message, (token) => writeEvent("token", { token }));
      writeEvent("done", result);
    } catch (error) {
      writeEvent("error", { error: error instanceof Error ? error.message : "KEIRA could not complete the request." });
    } finally {
      res.end();
    }
  });
  // Public identity material contains KEIRA's public key and signed receipt only.
  // It intentionally never creates keys, emits private material, or calls ARCHANGEL.
  app.get("/.well-known/keira-identity.json", async (_req, res) => {
    try {
      const status = await getKeiraPublicIdentityStatus();
      res.status(status.status === "RECEIPT_INVALID" ? 503 : 200).json({
        application: "KEIRA",
        status: status.status,
        manifest: status.manifest,
        verification: status.verification,
        reason: status.reason,
      });
    } catch (error) {
      res.status(503).json({
        application: "KEIRA",
        status: "RECEIPT_PENDING",
        manifest: null,
        verification: null,
        reason: error instanceof Error ? error.message : "KEIRA identity status is unavailable.",
      });
    }
  });
  app.get("/.well-known/keira-receipt.json", async (_req, res) => {
    try {
      const status = await getKeiraPublicIdentityStatus();
      res.status(status.status === "RECEIPT_ACTIVE" ? 200 : 503).json({
        application: "KEIRA",
        status: status.status,
        receipt: status.receipt,
        verification: status.verification,
        reason: status.reason,
      });
    } catch (error) {
      res.status(503).json({
        application: "KEIRA",
        status: "RECEIPT_PENDING",
        receipt: null,
        verification: null,
        reason: error instanceof Error ? error.message : "KEIRA receipt is unavailable.",
      });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3210", 10);
  if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
    throw new Error("PORT must be a valid TCP port number.");
  }
  const isProduction = process.env.NODE_ENV === "production";
  const port = isProduction ? preferredPort : await findAvailablePort(preferredPort);

  if (!isProduction && port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const host = process.env.HOST || (isProduction ? "0.0.0.0" : undefined);
  server.listen({ port, host }, () => {
    const displayHost = host || "localhost";
    console.log(`Server running on http://${displayHost}:${port}/`);
  });
}

startServer().catch(console.error);
