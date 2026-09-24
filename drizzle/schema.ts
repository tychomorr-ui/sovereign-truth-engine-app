import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  avatarUrl: text("avatarUrl"),
  avatarGlyph: varchar("avatarGlyph", { length: 16 }),
  alienBio: text("alienBio"),
  preferredVoice: varchar("preferredVoice", { length: 255 }),
  voiceRate: int("voiceRate").default(100).notNull(),
  voicePitch: int("voicePitch").default(100).notNull(),
  customPersona: text("customPersona"),
  customInstructions: text("customInstructions"),
  modelTemperature: int("modelTemperature").default(20).notNull(),
  predictiveSensitivity: int("predictiveSensitivity").default(75).notNull(),
  responseObjective: mysqlEnum("responseObjective", ["direct", "analysis", "creative", "plan"]).default("direct").notNull(),
  contextCarryover: mysqlEnum("contextCarryover", ["minimal", "standard", "extended"]).default("standard").notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const facts = mysqlTable("facts", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), subject: varchar("subject", { length: 255 }).notNull(), predicate: varchar("predicate", { length: 255 }).notNull(), object: varchar("object", { length: 255 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type Fact = typeof facts.$inferSelect;
export type InsertFact = typeof facts.$inferInsert;
export const ontologyClasses = mysqlTable("ontologyClasses", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), className: varchar("className", { length: 255 }).notNull(), parentClassName: varchar("parentClassName", { length: 255 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type OntologyClass = typeof ontologyClasses.$inferSelect;
export type InsertOntologyClass = typeof ontologyClasses.$inferInsert;
export const ontologyProperties = mysqlTable("ontologyProperties", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), propertyName: varchar("propertyName", { length: 255 }).notNull(), domain: varchar("domain", { length: 255 }), range: varchar("range", { length: 255 }), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type OntologyProperty = typeof ontologyProperties.$inferSelect;
export type InsertOntologyProperty = typeof ontologyProperties.$inferInsert;
export const semanticIndex = mysqlTable("semanticIndex", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), instanceName: varchar("instanceName", { length: 255 }).notNull(), className: varchar("className", { length: 255 }).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type SemanticIndexEntry = typeof semanticIndex.$inferSelect;
export type InsertSemanticIndexEntry = typeof semanticIndex.$inferInsert;
export const mirrorReflections = mysqlTable("mirrorReflections", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), userInput: text("userInput").notNull(), reflection: text("reflection").notNull(), patterns: text("patterns"), unityScore: int("unityScore").notNull(), opportunityScore: int("opportunityScore").notNull(), resistanceLevel: int("resistanceLevel").notNull(), nextStep: text("nextStep").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type MirrorReflection = typeof mirrorReflections.$inferSelect;
export type InsertMirrorReflection = typeof mirrorReflections.$inferInsert;
export const subscriptions = mysqlTable("subscriptions", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull(), stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).notNull().unique(), tier: mysqlEnum("tier", ["mirror", "portal"]).notNull(), status: mysqlEnum("status", ["active", "paused", "canceled", "past_due"]).notNull(), currentPeriodStart: timestamp("currentPeriodStart").notNull(), currentPeriodEnd: timestamp("currentPeriodEnd").notNull(), canceledAt: timestamp("canceledAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export const portalContexts = mysqlTable("portalContexts", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().unique(), stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }), contextData: text("contextData").notNull(), reflectionCount: int("reflectionCount").default(0).notNull(), lastReflectionAt: timestamp("lastReflectionAt"), sovereignRuntime: text("sovereignRuntime"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type PortalContext = typeof portalContexts.$inferSelect;
export type InsertPortalContext = typeof portalContexts.$inferInsert;
export const billingHistory = mysqlTable("billingHistory", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }), stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }), amount: int("amount").notNull(), currency: varchar("currency", { length: 3 }).default("USD").notNull(), tier: mysqlEnum("tier", ["mirror", "portal"]).notNull(), eventType: mysqlEnum("eventType", ["charge", "subscription_created", "subscription_updated", "subscription_canceled", "refund"]).notNull(), status: mysqlEnum("status", ["succeeded", "failed", "pending"]).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() });
export type BillingHistory = typeof billingHistory.$inferSelect;
export type InsertBillingHistory = typeof billingHistory.$inferInsert;
export const portalConversations = mysqlTable("portalConversations", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), title: varchar("title", { length: 255 }).notNull(), summary: text("summary"), messageCount: int("messageCount").default(0).notNull(), lastMessageAt: timestamp("lastMessageAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type PortalConversation = typeof portalConversations.$inferSelect;
export type InsertPortalConversation = typeof portalConversations.$inferInsert;
export const portalChatMessages = mysqlTable("portalChatMessages", { id: int("id").autoincrement().primaryKey(), conversationId: int("conversationId").notNull(), userId: int("userId").notNull(), role: mysqlEnum("role", ["user", "portal"]).notNull(), content: text("content").notNull(), patterns: text("patterns"), emotionalTone: varchar("emotionalTone", { length: 50 }), growthIndicator: int("growthIndicator"), createdAt: timestamp("createdAt").defaultNow().notNull() });
export type PortalChatMessage = typeof portalChatMessages.$inferSelect;
export type InsertPortalChatMessage = typeof portalChatMessages.$inferInsert;
export const portalLearningMemory = mysqlTable("portalLearningMemory", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull().unique(), corePatterns: text("corePatterns").notNull(), growthAreas: text("growthAreas").notNull(), resistancePoints: text("resistancePoints").notNull(), breakthroughMoments: text("breakthroughMoments"), evolutionTimeline: text("evolutionTimeline"), lastAnalyzedAt: timestamp("lastAnalyzedAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type PortalLearningMemory = typeof portalLearningMemory.$inferSelect;
export type InsertPortalLearningMemory = typeof portalLearningMemory.$inferInsert;
export const keiraContextEntries = mysqlTable("keiraContextEntries", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), label: varchar("label", { length: 120 }).notNull(), content: text("content").notNull(), kind: mysqlEnum("kind", ["fact", "preference", "goal", "note"]).default("note").notNull(), isActive: int("isActive").default(1).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });
export type KeiraContextEntry = typeof keiraContextEntries.$inferSelect;
export type InsertKeiraContextEntry = typeof keiraContextEntries.$inferInsert;

/** Durable, operator-controlled memory with explicit provenance and revocation. */
export const keiraMemoryRecords = mysqlTable("keiraMemoryRecords", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  memoryClass: varchar("memoryClass", { length: 64 }).notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 255 }).notNull(),
  authority: varchar("authority", { length: 32 }).notNull(),
  sensitivity: varchar("sensitivity", { length: 32 }).notNull(),
  retention: varchar("retention", { length: 32 }).notNull(),
  provenance: text("provenance").notNull(),
  revoked: int("revoked").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
});
export type KeiraMemoryRecord = typeof keiraMemoryRecords.$inferSelect;
export type InsertKeiraMemoryRecord = typeof keiraMemoryRecords.$inferInsert;

/** Durable inference and deterministic receipts; payloads remain local to the owning user. */
export const keiraIntelligenceReceipts = mysqlTable("keiraIntelligenceReceipts", {
  receiptId: varchar("receiptId", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  operation: varchar("operation", { length: 160 }).notNull(),
  intelligenceMode: varchar("intelligenceMode", { length: 32 }).notNull(),
  provider: varchar("provider", { length: 160 }),
  model: varchar("model", { length: 255 }),
  contextSources: text("contextSources").notNull(),
  externalServiceUsed: int("externalServiceUsed").default(0).notNull(),
  dataLeftLocalNode: int("dataLeftLocalNode").default(0).notNull(),
  policy: text("policy").notNull(),
  verification: text("verification").notNull(),
  resultState: varchar("resultState", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KeiraIntelligenceReceipt = typeof keiraIntelligenceReceipts.$inferSelect;
export type InsertKeiraIntelligenceReceipt = typeof keiraIntelligenceReceipts.$inferInsert;
