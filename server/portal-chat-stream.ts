import * as portalChat from "./portal-chat";
import { retrieveUserContext } from "./portal-context-retrieval";
import { classifyLearningStage } from "./portal-stage-classifier";
import { selectDialogueStrategy } from "./portal-strategy-selector";
import { generateAdaptiveResponse, detectStageTransition } from "./portal-adaptive-response";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { initializecMAPSession, processcMAPMessage, extractLivingContext } from "./cmap-portal-integration";
import { updateMissionState, type MissionState } from "./cmap-handshake";
import { getCarryoverMessageLimit, resolveContextCarryover } from "./keira-response-controls";
import { persistReceipt } from "./keira-durable-memory";
import { createReceipt } from "./sovereign-bus";
import { hashResponseRequest, readCachedResponse, writeCachedResponse } from "./response-cache";
import { ENV } from "./_core/env";

const cmapSessions = new Map<number, MissionState>();

export async function streamPortalMessage(
  userId: number,
  conversationId: number,
  message: string,
  onToken: (token: string) => void,
  trajectoryRootCid?: string,
) {
  await portalChat.addMessage(conversationId, userId, "user", message);

  let missionState = cmapSessions.get(conversationId) ?? await initializecMAPSession(userId);
  missionState = processcMAPMessage(message, missionState).missionState;
  cmapSessions.set(conversationId, missionState);

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const userRecord = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRecord.length) throw new Error("User not found");

  const userContext = await retrieveUserContext(userId, userRecord[0].createdAt);
  (userContext as any).profile = {
    customPersona: userRecord[0].customPersona,
    customInstructions: userRecord[0].customInstructions,
    modelTemperature: userRecord[0].modelTemperature,
    fastMode: userRecord[0].fastMode,
    predictiveSensitivity: userRecord[0].predictiveSensitivity,
    responseObjective: userRecord[0].responseObjective,
    contextCarryover: userRecord[0].contextCarryover,
  };
  const contextLedger = await portalChat.getContextEntries(userId);
  (userContext as any).contextLedger = contextLedger
    .filter((entry) => entry.isActive === 1)
    .map((entry) => ({ label: entry.label, content: entry.content, kind: entry.kind }));

  const stageClassification = classifyLearningStage(userContext);
  const strategySelection = selectDialogueStrategy(userContext, stageClassification, message);
  const conversationResult = await portalChat.getConversation(conversationId, userId);
  const carryoverPolicy = resolveContextCarryover(userRecord[0].contextCarryover);
  const recentMessages = conversationResult.messages
    .slice(0, -1)
    .slice(-getCarryoverMessageLimit(carryoverPolicy))
    .map((msg) => ({ role: msg.role as "user" | "portal", content: msg.content }));

  const selectedModel = userRecord[0].fastMode === 1 && ENV.localLlmFallbackModel
    ? ENV.localLlmFallbackModel
    : ENV.localLlmModel;
  const cacheKey = hashResponseRequest({ userId, query: message, trajectoryRootCid, model: selectedModel });
  const cached = await readCachedResponse(cacheKey);
  if (cached) {
    onToken(cached.response);
    const receipt = createReceipt({
      operation: "portal.conversation.generate",
      intelligence_mode: "local_model",
      provider: "local-cache",
      model: cached.model,
      context_sources: ["response-cache"],
      policy: "user-scoped local response cache; external providers disabled",
      verification: "previously generated local response replayed; no new inference performed",
      result_state: "CACHED_INFERENCE",
    });
    await persistReceipt(userId, receipt);
    await portalChat.addMessage(conversationId, userId, "portal", cached.response);
    return { response: cached.response, metadata: { provider: "local", modelId: cached.model, cached: true, receipt } };
  }

  const adaptiveResponse = await generateAdaptiveResponse(
    message,
    userContext,
    strategySelection,
    recentMessages,
    userRecord[0].modelTemperature,
    onToken,
    { model: selectedModel, fallbackModel: ENV.localLlmFallbackModel || undefined },
  );

  await writeCachedResponse({
    cacheKey,
    userId,
    queryHash: hashResponseRequest({ userId, query: message, trajectoryRootCid, model: selectedModel }),
    trajectoryRootCid,
    response: adaptiveResponse.response,
    model: adaptiveResponse.metadata.modelId ?? selectedModel,
  });

  await persistReceipt(userId, adaptiveResponse.metadata.receipt);
  await portalChat.addMessage(conversationId, userId, "portal", adaptiveResponse.response);
  const updates = adaptiveResponse.metadata.learningMemoryUpdates;
  if (Object.keys(updates).length > 0) await portalChat.updateLearningMemory(userId, updates);

  const stageTransition = detectStageTransition(adaptiveResponse.response, userContext);
  const livingContext = extractLivingContext(adaptiveResponse.response, missionState);
  missionState = updateMissionState(missionState, {
    ...livingContext,
    nextAction: adaptiveResponse.metadata.nextSuggestedAction || missionState.nextAction,
  });
  cmapSessions.set(conversationId, missionState);

  return {
    response: adaptiveResponse.response,
    metadata: {
      provider: adaptiveResponse.metadata.provider,
      modelId: adaptiveResponse.metadata.modelId,
      receipt: adaptiveResponse.metadata.receipt,
      strategy: adaptiveResponse.strategy,
      learningStage: stageClassification.stage,
      stageTransition: stageTransition.isTransitioning ? stageTransition.nextStage : null,
    },
  };
}
