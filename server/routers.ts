import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  isValidOwnerAccessToken,
  setSessionCookie,
  verifyPassword,
} from "./sovereign-auth";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { portalChatRouter } from "./portal-chat-router";
import { listMistTrajectories, persistMistTrajectory, readMistTrajectory } from "./mist-trajectory";
import type { MistResult } from "../client/src/lib/mist/types";
import { listBoomerangTrajectories, persistBoomerangTrajectory, readBoomerangTrajectory } from "./boomerang-persistence";
import type { BoomerangSwarmResult } from "../client/src/lib/boomerang/types";
import { ingestCorpusDocument } from "./corpus-ingestion";

export function canClaimResetAccount(user: { loginMethod: string | null; passwordHash: string | null } | null | undefined) {
  return user?.loginMethod === "auth-reset" && !user.passwordHash;
}

/**
 * Sovereign Portal API surface.
 * Legacy reflection, knowledge-graph, Stripe, and platform-system endpoints are
 * intentionally not mounted here so they cannot call third-party Forge services.
 */
export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),

    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(320),
        password: z.string().min(12).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.trim().toLowerCase();
        const existing = await db.getUserByEmail(email);
        if (existing && canClaimResetAccount(existing)) {
          const claimed = await db.setSovereignCredentials({
            userId: existing.id,
            email,
            name: input.name,
            passwordHash: await hashPassword(input.password),
          });
          if (!claimed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account claim failed." });
          setSessionCookie(ctx.req, ctx.res, await createSessionToken({ userId: claimed.id, name: claimed.name || input.name }));
          return claimed;
        }
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account already exists for that email." });
        }

        const passwordHash = await hashPassword(input.password);
        const user = await db.createSovereignUser({ email, name: input.name, passwordHash });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account creation failed." });

        setSessionCookie(ctx.req, ctx.res, await createSessionToken({ userId: user.id, name: user.name || input.name }));
        return user;
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(1).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email.trim().toLowerCase());
        if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        await db.upsertUser({ id: user.id, lastSignedIn: new Date() });
        setSessionCookie(ctx.req, ctx.res, await createSessionToken({ userId: user.id, name: user.name || "Operator" }));
        return user;
      }),

    claimAccount: publicProcedure
      .input(z.object({
        email: z.string().trim().email().max(320),
        name: z.string().trim().min(1).max(120),
        password: z.string().min(12).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.trim().toLowerCase();
        const user = await db.getUserByEmail(email);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No existing account matches that email." });
        if (user.passwordHash) throw new TRPCError({ code: "CONFLICT", message: "That account already has sovereign credentials." });

        const updated = await db.setSovereignCredentials({
          userId: user.id,
          email,
          name: input.name,
          passwordHash: await hashPassword(input.password),
        });
        if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account claim failed." });

        setSessionCookie(ctx.req, ctx.res, await createSessionToken({ userId: updated.id, name: updated.name || input.name }));
        return updated;
      }),

    updateProfile: protectedProcedure
      .input(z.object({
        avatarUrl: z.string().trim().url().refine((value) => value.startsWith("https://"), "Avatar URL must use HTTPS.").max(2048).nullable().optional(),
        avatarGlyph: z.string().trim().max(16).nullable().optional(),
        profileBio: z.string().trim().max(600).nullable().optional(),
        preferredVoice: z.string().trim().max(255).nullable().optional(),
        voiceRate: z.number().int().min(60).max(180).optional(),
        voicePitch: z.number().int().min(50).max(150).optional(),
        customPersona: z.string().trim().max(1000).nullable().optional(),
        customInstructions: z.string().trim().max(2000).nullable().optional(),
        modelTemperature: z.number().int().min(0).max(100).optional(),
        fastMode: z.number().int().min(0).max(1).optional(),
        predictiveSensitivity: z.number().int().min(0).max(100).optional(),
        responseObjective: z.enum(["direct", "analysis", "creative", "plan"]).optional(),
        contextCarryover: z.enum(["minimal", "standard", "extended"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const updated = await db.updateUserProfile(ctx.user.id, input);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Profile could not be updated." });
        return updated;
      }),

    ownerBootstrap: publicProcedure
      .input(z.object({ token: z.string().min(1).max(512) }))
      .mutation(async ({ ctx, input }) => {
        if (!isValidOwnerAccessToken(input.token)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid owner access token." });
        }

        const owner = await db.getUserByEmail("tyler@nexinus.net");
        if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "Owner account is not provisioned." });

        const promoted = await db.promoteUserToOwner(owner.id);
        if (!promoted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Owner session could not be created." });

        setSessionCookie(ctx.req, ctx.res, await createSessionToken({ userId: promoted.id, name: "Tyler Morris" }));
        return promoted;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),

  portal: router({
    chat: portalChatRouter,

    ingestDocument: protectedProcedure
      .input(z.object({
        filename: z.string().trim().min(1).max(255),
        mimeType: z.enum(["text/plain", "text/markdown"]),
        content: z.string().min(1).max(2_000_000),
      }))
      .mutation(({ ctx, input }) => ingestCorpusDocument(input, ctx.user.id)),

    persistMistTrajectory: protectedProcedure
      .input(z.object({ result: z.unknown() }))
      .mutation(async ({ ctx, input }) => persistMistTrajectory(ctx.user.id, input.result as MistResult)),

    getMistTrajectory: protectedProcedure
      .input(z.object({ trajectoryId: z.string().uuid() }))
      .query(async ({ ctx, input }) => readMistTrajectory(ctx.user.id, input.trajectoryId)),

    listMistTrajectories: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
      .query(async ({ ctx, input }) => listMistTrajectories(ctx.user.id, input.limit)),

    persistBoomerangTrajectory: protectedProcedure
      .input(z.object({ result: z.unknown() }))
      .mutation(async ({ ctx, input }) => persistBoomerangTrajectory(ctx.user.id, input.result as BoomerangSwarmResult)),

    getBoomerangTrajectory: protectedProcedure
      .input(z.object({ trajectoryId: z.string().uuid() }))
      .query(async ({ ctx, input }) => readBoomerangTrajectory(ctx.user.id, input.trajectoryId)),

    listBoomerangTrajectories: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(24) }))
      .query(async ({ ctx, input }) => listBoomerangTrajectories(ctx.user.id, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
