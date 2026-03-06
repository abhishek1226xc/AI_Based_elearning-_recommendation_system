import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createHash } from "crypto";
import {
  getAllCourses,
  getCourseById,
  searchCourses,
  getCoursesByCategory,
  getUserProfile,
  upsertUserProfile,
  getUserEnrolledCourses,
  recordCourseInteraction,
  getUserCourseInteractions,
  getUserRecommendations,
  saveRecommendations,
  getUserByEmail,
  createUser,
  getUserBookmarks,
  addBookmark,
  removeBookmark,
  getPlatformRatingsForCourse,
  getTopRatedCourses,
} from "./db";
import { contentBasedRecommendations, collaborativeRecommendations, popularityRecommendations, hybridRecommendations } from "./ml/recommender";
import { findRelatedCourses, getAIPoweredSuggestions, getTrendingInCategory, getPrerequisiteCourses, getAdvancedCourses } from "./ml/ai-recommender";
import { sdk } from "./_core/sdk";

function hashPassword(pw: string) {
  return createHash("sha256").update(pw).digest("hex");
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    register: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new Error("An account with this email already exists");
        }
        const pwHash = hashPassword(input.password);
        const user = await createUser({ email: input.email, name: input.name, passwordHash: pwHash });
        if (!user) throw new Error("Failed to create account");
        // Create session
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }
        const pwHash = hashPassword(input.password);
        if (pwHash !== user.passwordHash) {
          throw new Error("Invalid email or password");
        }
        // Create session
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),
  }),

  courses: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
      .query(async ({ input }) => getAllCourses(input.limit, input.offset)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getCourseById(input.id)),

    search: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().default(20) }))
      .query(async ({ input }) => searchCourses(input.query, input.limit)),

    byCategory: publicProcedure
      .input(z.object({ category: z.string(), limit: z.number().default(20) }))
      .query(async ({ input }) => getCoursesByCategory(input.category, input.limit)),

    topRated: publicProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => getTopRatedCourses(input.limit)),

    platformRatings: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => getPlatformRatingsForCourse(input.courseId)),

    categories: publicProcedure.query(async () => [
      "Web Development", "Data Science", "Machine Learning",
      "Mobile Development", "DevOps", "Cloud Computing",
      "Artificial Intelligence", "Cybersecurity", "Database Design",
      "Software Architecture", "Computer Science",
    ]),
  }),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => getUserProfile(ctx.user.id)),
    update: protectedProcedure
      .input(z.object({
        skills: z.array(z.string()).optional(),
        interests: z.array(z.string()).optional(),
        learningGoals: z.array(z.string()).optional(),
        preferredDifficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        learningStyle: z.string().optional(),
        bio: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await getUserProfile(ctx.user.id);
        const updated = {
          ...profile,
          skills: input.skills ? JSON.stringify(input.skills) : profile?.skills,
          interests: input.interests ? JSON.stringify(input.interests) : profile?.interests,
          learningGoals: input.learningGoals ? JSON.stringify(input.learningGoals) : profile?.learningGoals,
          preferredDifficulty: input.preferredDifficulty || profile?.preferredDifficulty,
          learningStyle: input.learningStyle || profile?.learningStyle,
          bio: input.bio || profile?.bio,
        };
        return upsertUserProfile(ctx.user.id, updated);
      }),
  }),

  bookmarks: router({
    list: protectedProcedure.query(async ({ ctx }) => getUserBookmarks(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ courseId: z.number(), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => addBookmark(ctx.user.id, input.courseId, input.notes)),
    remove: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ ctx, input }) => removeBookmark(ctx.user.id, input.courseId)),
  }),

  enrollment: router({
    enrolledCourses: protectedProcedure.query(async ({ ctx }) => getUserEnrolledCourses(ctx.user.id)),
    enroll: protectedProcedure
      .input(z.object({ courseId: z.number() }))
      .mutation(async ({ ctx, input }) => recordCourseInteraction(ctx.user.id, input.courseId, "started")),
    recordInteraction: protectedProcedure
      .input(z.object({
        courseId: z.number(),
        interactionType: z.enum(["viewed", "started", "completed", "rated", "bookmarked"]),
        rating: z.number().optional(),
        timeSpent: z.number().optional(),
        completionPercentage: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) =>
        recordCourseInteraction(ctx.user.id, input.courseId, input.interactionType, input.rating, input.timeSpent, input.completionPercentage)),
    getInteractions: protectedProcedure.query(async ({ ctx }) => getUserCourseInteractions(ctx.user.id)),
  }),

  recommendations: router({
    getForUser: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }))
      .query(async ({ ctx, input }) => getUserRecommendations(ctx.user.id, input.limit)),

    generate: protectedProcedure
      .input(z.object({ algorithm: z.enum(["content-based", "collaborative", "hybrid", "popularity"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        let recs: any[] = [];
        if (input.algorithm === "collaborative") recs = await collaborativeRecommendations(userId, 10);
        else if (input.algorithm === "popularity") recs = await popularityRecommendations(userId, 10);
        else if (input.algorithm === "hybrid") recs = await hybridRecommendations(userId, 10);
        else recs = await contentBasedRecommendations(userId, 10);

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const recsToSave = recs.map((rec, index) => ({
          userId, courseId: rec.courseId,
          score: Math.round(rec.score * 100), reason: rec.reason,
          algorithm: rec.algorithm, rank: index + 1, expiresAt,
        }));
        await saveRecommendations(recsToSave);
        return recsToSave;
      }),

    relatedCourses: publicProcedure
      .input(z.object({ courseId: z.number(), limit: z.number().default(5) }))
      .query(async ({ input }) => findRelatedCourses(input.courseId, input.limit)),

    aiSuggestions: protectedProcedure
      .input(z.object({ courseId: z.number(), limit: z.number().default(8) }))
      .query(async ({ ctx, input }) => getAIPoweredSuggestions(ctx.user.id, input.courseId, input.limit)),

    trending: publicProcedure
      .input(z.object({ category: z.string(), limit: z.number().default(5) }))
      .query(async ({ input }) => getTrendingInCategory(input.category, input.limit)),

    prerequisites: publicProcedure
      .input(z.object({ courseId: z.number(), limit: z.number().default(3) }))
      .query(async ({ input }) => getPrerequisiteCourses(input.courseId, input.limit)),

    advanced: publicProcedure
      .input(z.object({ courseId: z.number(), limit: z.number().default(3) }))
      .query(async ({ input }) => getAdvancedCourses(input.courseId, input.limit)),
  }),
});

export type AppRouter = typeof appRouter;
