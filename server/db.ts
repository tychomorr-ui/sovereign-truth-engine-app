import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, facts, ontologyClasses, ontologyProperties, semanticIndex, Fact, OntologyClass, OntologyProperty, SemanticIndexEntry } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.id && !user.openId && !user.email) {
    throw new Error("User identity is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { ...user };
    const updateSet: Record<string, unknown> = {};

    if (user.email != null) {
      values.email = user.email.trim().toLowerCase();
      updateSet.email = values.email;
    }
    if (user.name !== undefined) updateSet.name = user.name ?? null;
    if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod ?? null;
    if (user.passwordHash !== undefined) updateSet.passwordHash = user.passwordHash ?? null;
    if (user.lastSignedIn !== undefined) updateSet.lastSignedIn = user.lastSignedIn;
    if (user.role !== undefined) updateSet.role = user.role;

    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.name, name)).orderBy(users.id).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Temporary beta-open identity. It is deliberately a non-owner account with no
 * password and cannot be used once BETA_OPEN_MODE is disabled.
 */
export async function getOrCreateBetaUser() {
  const betaEmail = "beta@keira.local";
  const existing = await getUserByEmail(betaEmail);
  if (existing) return existing;

  const db = await getDb();
  if (!db) return undefined;
  try {
    await db.insert(users).values({
      email: betaEmail,
      name: "KEIRA Beta Operator",
      loginMethod: "beta-open",
      role: "user",
      lastSignedIn: new Date(),
    });
  } catch {
    // A concurrent request may have created the singleton beta identity.
  }
  return getUserByEmail(betaEmail);
}

export async function promoteUserToOwner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ role: "admin", lastSignedIn: new Date() }).where(eq(users.id, id));
  return getUserById(id);
}

export async function updateUserProfile(id: number, input: {
  avatarUrl?: string | null;
  avatarGlyph?: string | null;
  alienBio?: string | null;
  preferredVoice?: string | null;
  voiceRate?: number;
  voicePitch?: number;
  customPersona?: string | null;
  customInstructions?: string | null;
  modelTemperature?: number;
  predictiveSensitivity?: number;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database is not available");
  await database.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, id));
  return getUserById(id);
}

export async function createSovereignUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const email = input.email.trim().toLowerCase();
  await db.insert(users).values({
    email,
    name: input.name.trim(),
    passwordHash: input.passwordHash,
    loginMethod: "sovereign",
    lastSignedIn: new Date(),
  });
  return getUserByEmail(email);
}

export async function setSovereignCredentials(input: {
  userId: number;
  email: string;
  name: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const email = input.email.trim().toLowerCase();
  await db.update(users).set({
    email,
    name: input.name.trim(),
    passwordHash: input.passwordHash,
    loginMethod: "sovereign",
    lastSignedIn: new Date(),
  }).where(eq(users.id, input.userId));
  return getUserById(input.userId);
}

// Knowledge Graph Queries

export async function addFact(userId: number, subject: string, predicate: string, object: string): Promise<Fact | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(facts).values({
      userId,
      subject,
      predicate,
      object,
    });
    const inserted = await db.select().from(facts).where(eq(facts.userId, userId)).orderBy(facts.id).limit(1);
    return inserted.length > 0 ? inserted[inserted.length - 1] : null;
  } catch (error) {
    console.error("[Database] Failed to add fact:", error);
    return null;
  }
}

export async function removeFact(userId: number, subject: string, predicate: string, object: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(facts).where(
      and(
        eq(facts.userId, userId),
        eq(facts.subject, subject),
        eq(facts.predicate, predicate),
        eq(facts.object, object)
      )
    );
    return true;
  } catch (error) {
    console.error("[Database] Failed to remove fact:", error);
    return false;
  }
}

export async function getFacts(userId: number, subject?: string, predicate?: string, object?: string): Promise<Fact[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const conditions = [eq(facts.userId, userId)];
    
    if (subject) {
      conditions.push(eq(facts.subject, subject));
    }
    if (predicate) {
      conditions.push(eq(facts.predicate, predicate));
    }
    if (object) {
      conditions.push(eq(facts.object, object));
    }
    
    return await db.select().from(facts).where(and(...conditions));
  } catch (error) {
    console.error("[Database] Failed to get facts:", error);
    return [];
  }
}

export async function defineClass(userId: number, className: string, parentClassName?: string): Promise<OntologyClass | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(ontologyClasses).values({
      userId,
      className,
      parentClassName: parentClassName || null,
    });
    const result = await db.select().from(ontologyClasses).where(
      and(eq(ontologyClasses.userId, userId), eq(ontologyClasses.className, className))
    ).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to define class:", error);
    return null;
  }
}

export async function getClasses(userId: number): Promise<OntologyClass[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db.select().from(ontologyClasses).where(eq(ontologyClasses.userId, userId));
  } catch (error) {
    console.error("[Database] Failed to get classes:", error);
    return [];
  }
}

export async function defineProperty(userId: number, propertyName: string, domain?: string, range?: string): Promise<OntologyProperty | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(ontologyProperties).values({
      userId,
      propertyName,
      domain: domain || null,
      range: range || null,
    });
    const result = await db.select().from(ontologyProperties).where(
      and(eq(ontologyProperties.userId, userId), eq(ontologyProperties.propertyName, propertyName))
    ).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to define property:", error);
    return null;
  }
}

export async function getProperties(userId: number): Promise<OntologyProperty[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db.select().from(ontologyProperties).where(eq(ontologyProperties.userId, userId));
  } catch (error) {
    console.error("[Database] Failed to get properties:", error);
    return [];
  }
}

export async function associateInstance(userId: number, instanceName: string, className: string): Promise<SemanticIndexEntry | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(semanticIndex).values({
      userId,
      instanceName,
      className,
    });
    const result = await db.select().from(semanticIndex).where(
      and(eq(semanticIndex.userId, userId), eq(semanticIndex.instanceName, instanceName), eq(semanticIndex.className, className))
    ).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to associate instance:", error);
    return null;
  }
}

export async function getEntityTypes(userId: number, instanceName: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const results = await db.select().from(semanticIndex).where(
      and(eq(semanticIndex.userId, userId), eq(semanticIndex.instanceName, instanceName))
    );
    return results.map(r => r.className);
  } catch (error) {
    console.error("[Database] Failed to get entity types:", error);
    return [];
  }
}

export async function removeClass(userId: number, className: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(ontologyClasses).where(
      and(eq(ontologyClasses.userId, userId), eq(ontologyClasses.className, className))
    );
    return true;
  } catch (error) {
    console.error("[Database] Failed to remove class:", error);
    return false;
  }
}

export async function removeProperty(userId: number, propertyName: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    await db.delete(ontologyProperties).where(
      and(eq(ontologyProperties.userId, userId), eq(ontologyProperties.propertyName, propertyName))
    );
    return true;
  } catch (error) {
    console.error("[Database] Failed to remove property:", error);
    return false;
  }
}
