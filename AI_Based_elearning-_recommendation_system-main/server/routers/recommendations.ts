import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { db } from "../_core/db";
import {
  generateRecommendations,
  getRecommendationsForUser,
} from "../recommendationEngine";
import {
  findRelatedCourses,
  getAIPoweredSuggestions,
  getTrendingInCategory,
  getPrerequisiteCourses,
  getAdvancedCourses,
} from "../ml/ai-recommender";

const feedbackSchema = z.enum(["relevant", "not_relevant", "already_done"]);

const toIsoFromUnix = (unixTs: number): string => {
  const millis = unixTs > 1_000_000_000_000 ? unixTs : unixTs * 1000;
  return new Date(millis).toISOString();
};

export const recommendationsRouter = router({
  getForUser: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        const user = db
          .prepare("SELECT id FROM users WHERE id = ?")
          .get(input.userId) as { id: number } | undefined;

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `User ${input.userId} not found`,
          });
        }

        return await getRecommendationsForUser(input.userId);
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error ? error.message : "Failed to fetch recommendations";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  refresh: protectedProcedure
    .input(z.object({ userId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const targetUserId = input.userId;
        const isOwner = typeof targetUserId === "number" && ctx.user.id === targetUserId;
        const isAdmin = ctx.user.role === "admin";

        if (!isOwner && !isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not allowed to refresh these recommendations",
          });
        }

        await generateRecommendations(targetUserId);

        return {
          success: true,
          regeneratedAt: new Date().toISOString(),
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const message =
          error instanceof Error ? error.message : "Failed to refresh recommendations";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  submitFeedback: protectedProcedure
    .input(
      z.object({
        recommendationId: z.number().int().positive(),
        feedback: feedbackSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        db.prepare(
          `INSERT INTO recommendationFeedback (userId, recommendationId, feedback, timestamp)
           VALUES (?, ?, ?, ?)`
        ).run(
          ctx.user.id,
          input.recommendationId,
          input.feedback,
          Math.floor(Date.now() / 1000)
        );

        return { success: true };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to submit feedback";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  getStats: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(({ input }) => {
      try {
        const user = db
          .prepare("SELECT id FROM users WHERE id = ?")
          .get(input.userId) as { id: number } | undefined;

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `User ${input.userId} not found`,
          });
        }

        const totals = db
          .prepare(
            `SELECT
                COUNT(*) AS totalRecommendations,
                COALESCE(AVG(score), 0) AS avgScore
             FROM recommendations
             WHERE userId = ?`
          )
          .get(input.userId) as {
          totalRecommendations: number;
          avgScore: number;
        };

        const latest = db
          .prepare(
            `SELECT algorithm, expiresAt
             FROM recommendations
             WHERE userId = ?
             ORDER BY generatedAt DESC, id DESC
             LIMIT 1`
          )
          .get(input.userId) as
          | {
              algorithm: string;
              expiresAt: number;
            }
          | undefined;

        const topCategory = db
          .prepare(
            `SELECT c.category AS category, COUNT(*) AS categoryCount
             FROM recommendations r
             JOIN courses c ON c.id = r.courseId
             WHERE r.userId = ?
             GROUP BY c.category
             ORDER BY categoryCount DESC, c.category ASC
             LIMIT 1`
          )
          .get(input.userId) as { category: string } | undefined;

        return {
          totalRecommendations: totals.totalRecommendations ?? 0,
          avgScore: Number(totals.avgScore ?? 0),
          algorithmUsed: latest?.algorithm ?? "n/a",
          expiresAt: latest ? toIsoFromUnix(latest.expiresAt) : new Date(0).toISOString(),
          topCategory: topCategory?.category ?? "n/a",
        };
      } catch (error: unknown) {
        if (error instanceof TRPCError) throw error;
        const message = error instanceof Error ? error.message : "Failed to load stats";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  // Compatibility procedures for existing pages.
  generate: protectedProcedure
    .input(
      z.object({
        algorithm: z
          .enum(["content-based", "collaborative", "hybrid", "popularity"])
          .optional(),
      })
    )
    .mutation(async ({ ctx }) => {
      try {
        await generateRecommendations(ctx.user.id);
        return { success: true };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to generate recommendations";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  relatedCourses: publicProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().default(5) }))
    .query(async ({ input }) => {
      try {
        return await findRelatedCourses(input.courseId, input.limit);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch related courses";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  aiSuggestions: protectedProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().default(8) }))
    .query(async ({ ctx, input }) => {
      try {
        return await getAIPoweredSuggestions(ctx.user.id, input.courseId, input.limit);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch AI suggestions";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  trending: publicProcedure
    .input(z.object({ category: z.string(), limit: z.number().default(5) }))
    .query(async ({ input }) => {
      try {
        return await getTrendingInCategory(input.category, input.limit);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch trending courses";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  prerequisites: publicProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().default(3) }))
    .query(async ({ input }) => {
      try {
        return await getPrerequisiteCourses(input.courseId, input.limit);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch prerequisites";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  advanced: publicProcedure
    .input(z.object({ courseId: z.number(), limit: z.number().default(3) }))
    .query(async ({ input }) => {
      try {
        return await getAdvancedCourses(input.courseId, input.limit);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch advanced courses";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),
});
