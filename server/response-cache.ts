import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { keiraResponseCache } from "../drizzle/schema";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function hashResponseRequest(input: {
  userId: number;
  query: string;
  trajectoryRootCid?: string | null;
  model: string;
}) {
  return createHash("sha256")
    .update(JSON.stringify({
      userId: input.userId,
      query: input.query.trim(),
      trajectoryRootCid: input.trajectoryRootCid ?? null,
      model: input.model,
    }))
    .digest("hex");
}

export async function readCachedResponse(cacheKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(keiraResponseCache).where(eq(keiraResponseCache.cacheKey, cacheKey)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - row.createdAt.getTime() > CACHE_TTL_MS) return null;
  return row;
}

export async function writeCachedResponse(input: {
  cacheKey: string;
  userId: number;
  queryHash: string;
  trajectoryRootCid?: string | null;
  response: string;
  model: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(keiraResponseCache).values({
    cacheKey: input.cacheKey,
    userId: input.userId,
    queryHash: input.queryHash,
    trajectoryRootCid: input.trajectoryRootCid ?? null,
    response: input.response,
    model: input.model,
  }).onDuplicateKeyUpdate({
    set: {
      response: input.response,
      model: input.model,
      trajectoryRootCid: input.trajectoryRootCid ?? null,
      createdAt: new Date(),
    },
  });
}
