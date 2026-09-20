/**
 * Portal Chat Router - Integrated Adaptive Response Engine
 * 
 * Combines context retrieval, learning stage classification, strategy selection,
 * and adaptive response generation for world-class Portal Chat.
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as portalChat from "./portal-chat";
import { retrieveUserContext, formatContextForLLM } from "./portal-context-retrieval";
import { classifyLearningStage } from "./portal-stage-classifier";
import { selectDialogueStrategy } from "./portal-strategy-selector";
import { generateAdaptiveResponse, detectStageTransition } from "./portal-adaptive-response";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  initializecMAPSession,
  processcMAPMessage,
  extractLivingContext,
} from "./cmap-portal-integration";
import { updateMissionState, type MissionState } from "./cmap-handshake";
import { getKeiraCapabilities } from "./keira-capabilities";
import { getRuntimeReport } from "./runtime-discovery";
import {
  getCarryoverMessageLimit,
  resolveContextCarryover,
  resolveResponseObjective,
} from "./keira-response-controls";

const cmapSessions = new Map<number, MissionState>(); // Keyed by conversationId

export const portalChatRouter = router({
  getCapabilities: protectedProcedure.query(() => getKeiraCapabilities()),

  getRuntimeStatus: protectedProcedure.query(async () => getRuntimeReport()),

  getContextLedger: protectedProcedure.query(async ({ ctx }) => {
    return await portalChat.getContextEntries(ctx.user.id);
  }),

  addContextLedgerEntry: protectedProcedure
    .input(z.object({
      label: z.string().trim().min(1).max(120),
      content: z.string().trim().min(1).max(4000),
      kind: z.enum(["fact", "preference", "goal", "note"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return await portalChat.createContextEntry(ctx.user.id, input);
    }),

  setContextLedgerEntryActive: protectedProcedure
    .input(z.object({ entryId: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await portalChat.setContextEntryActive(ctx.user.id, input.entryId, input.isActive);
      return { ok: true };
    }),

  deleteContextLedgerEntry: protectedProcedure
    .input(z.object({ entryId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await portalChat.deleteContextEntry(ctx.user.id, input.entryId);
      return { ok: true };
    }),

  searchConversationRecall: protectedProcedure
    .input(z.object({ query: z.string().trim().min(2).max(120), limit: z.number().int().min(1).max(12).default(6) }))
    .query(async ({ ctx, input }) => {
      const matches = await portalChat.searchConversationRecall(ctx.user.id, input.query, input.limit);
      return {
        source: "operator-owned stored dialogue" as const,
        matches,
      };
    }),

  promoteRecallToContextLedger: protectedProcedure
    .input(z.object({
      messageId: z.number().int().positive(),
      label: z.string().trim().min(1).max(120),
      kind: z.enum(["fact", "preference", "goal", "note"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = await portalChat.getRecallMessageForUser(ctx.user.id, input.messageId);
      if (!message) throw new Error("Stored dialogue message not found or unauthorized");

      const content = message.content.slice(0, 4000);
      const entryId = await portalChat.createContextEntry(ctx.user.id, {
        label: input.label,
        content,
        kind: input.kind,
      });
      return { entryId, truncated: message.content.length > content.length };
    }),

  getConversations: protectedProcedure.query(async ({ ctx }) => {
    return await portalChat.getUserConversations(ctx.user.id);
  }),

  createConversation: protectedProcedure
    .input(z.object({ title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await portalChat.createConversation(ctx.user.id, input.title);
    }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await portalChat.getConversation(input.conversationId, ctx.user.id);
      return {
        conversation: result.conversation,
        messages: result.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ conversationId: z.number(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { conversationId, message } = input;

      // Add user message
      await portalChat.addMessage(conversationId, ctx.user.id, "user", message);

      // cMAP is additive session awareness for the active Portal conversation.
      // State is intentionally in-memory until durable mission storage is added;
      // unavailable state is never represented as fabricated telemetry.
      let missionState = cmapSessions.get(conversationId);
      if (!missionState) {
        missionState = await initializecMAPSession(ctx.user.id);
      }
      missionState = processcMAPMessage(message, missionState).missionState;
      cmapSessions.set(conversationId, missionState);

      // Get user's creation date for context
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!userRecord.length) throw new Error("User not found");

      const userCreatedAt = userRecord[0].createdAt;

      // Retrieve comprehensive user context and attach user profile settings
      const userContext = await retrieveUserContext(ctx.user.id, userCreatedAt);
      (userContext as any).profile = {
        customPersona: userRecord[0].customPersona,
        customInstructions: userRecord[0].customInstructions,
        modelTemperature: userRecord[0].modelTemperature,
        predictiveSensitivity: userRecord[0].predictiveSensitivity,
        responseObjective: userRecord[0].responseObjective,
        contextCarryover: userRecord[0].contextCarryover,
      };
      const contextLedger = await portalChat.getContextEntries(ctx.user.id);
      (userContext as any).contextLedger = contextLedger
        .filter((entry) => entry.isActive === 1)
        .map((entry) => ({ label: entry.label, content: entry.content, kind: entry.kind }));

      // Classify learning stage
      const stageClassification = classifyLearningStage(userContext);

      // The current operator request takes priority over historic stage metadata.
      const strategySelection = selectDialogueStrategy(userContext, stageClassification, message);

      // Get conversation history for context
      const conversationResult = await portalChat.getConversation(conversationId, ctx.user.id);
      const carryoverPolicy = resolveContextCarryover(userRecord[0].contextCarryover);
      const carryoverMessageLimit = getCarryoverMessageLimit(carryoverPolicy);
      // The just-persisted operator message is supplied separately to the model.
      // Excluding it here prevents duplicate current-turn input.
      const recentMessages = conversationResult.messages.slice(0, -1).slice(-carryoverMessageLimit).map((msg) => ({
        role: msg.role as 'user' | 'portal',
        content: msg.content,
      }));

      const startTime = Date.now();
      // Generate adaptive response
      const adaptiveResponse = await generateAdaptiveResponse(
        message,
        userContext,
        strategySelection,
        recentMessages,
        userRecord[0].modelTemperature,
      );
      const latencyMs = Date.now() - startTime;

      // Add Portal response
      await portalChat.addMessage(
        conversationId,
        ctx.user.id,
        "portal",
        adaptiveResponse.response
      );

      // Update learning memory with new insights
      const updates = adaptiveResponse.metadata.learningMemoryUpdates;
      if (Object.keys(updates).length > 0) {
        await portalChat.updateLearningMemory(ctx.user.id, updates);
      }

      // Check for stage transitions
      const stageTransition = detectStageTransition(adaptiveResponse.response, userContext);

      const livingContext = extractLivingContext(adaptiveResponse.response, missionState);
      missionState = updateMissionState(missionState, {
        ...livingContext,
        nextAction: adaptiveResponse.metadata.nextSuggestedAction || missionState.nextAction,
      });
      cmapSessions.set(conversationId, missionState);

      return {
        portalResponse: adaptiveResponse.response,
        metadata: {
          strategy: adaptiveResponse.strategy,
          learningStage: stageClassification.stage,
          breakthroughReadiness: userContext.synthesis.breakthroughReadiness,
          resistanceLevel: userContext.synthesis.resistanceLevel,
          stageTransition: stageTransition.isTransitioning ? stageTransition.nextStage : null,
          nextAction: adaptiveResponse.metadata.nextSuggestedAction,
          provider: adaptiveResponse.metadata.provider,
          modelId: adaptiveResponse.metadata.modelId,
          responseObjective: resolveResponseObjective(userRecord[0].responseObjective),
          contextCarryover: carryoverPolicy,
          carryoverMessages: adaptiveResponse.metadata.carryoverMessageCount,
          qualityContract: adaptiveResponse.metadata.qualityContract,
          receipt: adaptiveResponse.metadata.receipt,
          latencyMs,
          cmap: {
            sessionId: missionState.sessionId,
            handshakeComplete: true,
            missionIntent: missionState.missionIntent,
            missionStatus: missionState.missionStatus,
            decisions: missionState.decisions,
            evidence: missionState.evidence,
            openQuestions: missionState.openQuestions,
            nextAction: missionState.nextAction,
          },
        },
      };
    }),

  // New endpoint: Get user's learning profile
  getLearningProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!userRecord.length) throw new Error("User not found");

    const userContext = await retrieveUserContext(ctx.user.id, userRecord[0].createdAt);
    const stageClassification = classifyLearningStage(userContext);

    return {
      learningStage: stageClassification.stage,
      confidence: stageClassification.confidence,
      indicators: stageClassification.indicators,
      recommendations: stageClassification.recommendations,
      rationale: stageClassification.rationale,
      synthesis: userContext.synthesis,
      corePatterns: userContext.learning.corePatterns,
      growthAreas: userContext.learning.growthAreas,
      resistancePoints: userContext.learning.resistancePoints,
      breakthroughMoments: userContext.learning.breakthroughMoments,
      geometryProfile: userContext.mirror.geometryProfile,
    };
  }),

  // New endpoint: Get strategy analysis
  getStrategyAnalysis: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!userRecord.length) throw new Error("User not found");

      const userContext = await retrieveUserContext(ctx.user.id, userRecord[0].createdAt);
      const stageClassification = classifyLearningStage(userContext);
      const strategySelection = selectDialogueStrategy(userContext, stageClassification);

      return {
        strategy: strategySelection.strategy,
        rationale: strategySelection.rationale,
        guidelines: strategySelection.responseGuidelines,
        contextInjectionPoints: strategySelection.contextInjectionPoints,
      };
    }),
});
