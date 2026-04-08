import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hashPassword, comparePassword } from "./utils/crypto";
import crypto from "crypto";
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
  getUserByEmail,
  createUser,
  getUserBookmarks,
  addBookmark,
  removeBookmark,
  getPlatformRatingsForCourse,
  getTopRatedCourses,
  createChatSession,
  getChatSessions,
  getChatMessages,
  addChatMessage,
  deleteChatSession,
  getUserLearningPaths,
  getUserLoginHistory,
  addUserLoginHistory,
  updateUserLoginMeta,
  setResetPasswordToken,
  updateUserPassword,
  addAdminActivity,
} from "./db";
import { findRelatedCourses } from "./ml/ai-recommender";
import { sdk } from "./_core/sdk";
import { aiService } from "./_core/ai";
import { recommendationsRouter } from "./routers/recommendations";
import { db as sqliteDb } from "./_core/db";

type SearchedCourse = Awaited<ReturnType<typeof searchCourses>>[number];

const text500 = z.string().trim().max(500, "Must be 500 characters or fewer");
const text50Array = z
  .array(z.string().trim().max(50, "Each item must be 50 characters or fewer"))
  .max(20, "Maximum 20 items allowed");

const emailSchema = z.string().trim().email("Please enter a valid email").max(320);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);
const nameSchema = z.string().trim().min(2, "Name must be at least 2 characters").max(100);

const RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 30 * 60 * 1000;

type RateLimitState = { count: number; firstAt: number; lockedUntil?: number };
const forgotPasswordRate = new Map<string, RateLimitState>();
const loginAttemptRate = new Map<string, RateLimitState>();

const getClientIp = (req: { headers?: Record<string, unknown>; ip?: string | undefined }) => {
  const header = req.headers?.["x-forwarded-for"];
  if (typeof header === "string") return header.split(",")[0].trim();
  return req.ip ?? "unknown";
};

const checkRateLimit = (
  map: Map<string, RateLimitState>,
  key: string,
  max: number,
  windowMs: number,
  lockMs?: number
) => {
  const now = Date.now();
  const state = map.get(key);
  if (state?.lockedUntil && state.lockedUntil > now) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
  }

  if (!state || now - state.firstAt > windowMs) {
    map.set(key, { count: 1, firstAt: now });
    return;
  }

  if (state.count >= max) {
    const lockedUntil = lockMs ? now + lockMs : undefined;
    map.set(key, { count: state.count, firstAt: state.firstAt, lockedUntil });
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again later." });
  }

  map.set(key, { ...state, count: state.count + 1 });
};

const resetRateLimit = (map: Map<string, RateLimitState>, key: string) => {
  map.delete(key);
};

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions });
      return { success: true } as const;
    }),

    register: publicProcedure
      .input(z.object({
        name: nameSchema,
        email: emailSchema,
        password: passwordSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await getUserByEmail(input.email);
          if (existing) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "An account with this email already exists" });
          }
          const pwHash = hashPassword(input.password);
          const user = await createUser({ email: input.email, name: input.name, passwordHash: pwHash });
          if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create account" });
          // Create session
          const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email } };
        } catch (error: unknown) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Registration failed";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    login: publicProcedure
      .input(z.object({
        email: emailSchema,
        password: passwordSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        const ip = getClientIp(ctx.req);
        const nowMs = Date.now();
        const existing = loginAttemptRate.get(ip);
        if (existing?.lockedUntil && existing.lockedUntil > nowMs) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
        }
        if (existing && nowMs - existing.firstAt > RATE_WINDOW_MS) {
          loginAttemptRate.delete(ip);
        }

        const recordFailure = async (userId?: number) => {
          const state = loginAttemptRate.get(ip);
          const base = state && nowMs - state.firstAt <= RATE_WINDOW_MS
            ? { count: state.count + 1, firstAt: state.firstAt }
            : { count: 1, firstAt: nowMs };

          const lockedUntil = base.count >= 10 ? nowMs + LOGIN_LOCK_MS : state?.lockedUntil;
          loginAttemptRate.set(ip, { ...base, lockedUntil });
          if (userId) {
            await addUserLoginHistory(userId, ip, ctx.req.headers["user-agent"] as string | undefined ?? null, 0);
          }
          if (lockedUntil && lockedUntil > nowMs) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        };

        try {
          const user = await getUserByEmail(input.email);
          if (!user || !user.passwordHash) {
            await recordFailure();
          }
          if (user.isBanned) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Account is banned" });
          }
          if (user.isActive === 0) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Account is inactive" });
          }
          const isValid = await comparePassword(input.password, user.passwordHash);
          if (!isValid) {
            await recordFailure(user.id);
          }
          resetRateLimit(loginAttemptRate, ip);
          await addUserLoginHistory(user.id, ip, ctx.req.headers["user-agent"] as string | undefined ?? null, 1);
          await updateUserLoginMeta(user.id, ip);
          const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email } };
        } catch (error: unknown) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Login failed";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    adminLogin: publicProcedure
      .input(z.object({ email: emailSchema, password: passwordSchema }))
      .mutation(async ({ input, ctx }) => {
        const ip = getClientIp(ctx.req);
        const nowMs = Date.now();
        const existing = loginAttemptRate.get(ip);
        if (existing?.lockedUntil && existing.lockedUntil > nowMs) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
        }
        if (existing && nowMs - existing.firstAt > RATE_WINDOW_MS) {
          loginAttemptRate.delete(ip);
        }

        const recordFailure = async (userId?: number) => {
          const state = loginAttemptRate.get(ip);
          const base = state && nowMs - state.firstAt <= RATE_WINDOW_MS
            ? { count: state.count + 1, firstAt: state.firstAt }
            : { count: 1, firstAt: nowMs };

          const lockedUntil = base.count >= 10 ? nowMs + LOGIN_LOCK_MS : state?.lockedUntil;
          loginAttemptRate.set(ip, { ...base, lockedUntil });
          if (userId) {
            await addUserLoginHistory(userId, ip, ctx.req.headers["user-agent"] as string | undefined ?? null, 0);
          }
          if (lockedUntil && lockedUntil > nowMs) {
            throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many login attempts. Try again later." });
          }
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin credentials" });
        };

        try {
          const user = await getUserByEmail(input.email);
          if (!user || !user.passwordHash || user.role !== "admin") {
            await recordFailure(user?.id);
          }
          if (user.isBanned || user.isActive === 0) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin account is unavailable" });
          }
          const isValid = await comparePassword(input.password, user.passwordHash);
          if (!isValid) {
            await recordFailure(user.id);
          }
          resetRateLimit(loginAttemptRate, ip);
          await addUserLoginHistory(user.id, ip, ctx.req.headers["user-agent"] as string | undefined ?? null, 1);
          await updateUserLoginMeta(user.id, ip);
          const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
        } catch (error: unknown) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Admin login failed";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    forgotPassword: publicProcedure
      .input(z.object({ email: emailSchema }))
      .mutation(async ({ input, ctx }) => {
        const ip = getClientIp(ctx.req);
        checkRateLimit(forgotPasswordRate, ip, 5, RATE_WINDOW_MS);
        try {
          const user = await getUserByEmail(input.email);
          if (user) {
            const token = crypto.randomBytes(32).toString("hex");
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            await setResetPasswordToken(user.id, token, expiresAt);
            console.log(`RESET LINK: /reset-password?token=${token}`);
          }
          return { success: true, message: "If this email exists, a reset link has been sent." };
        } catch (error: unknown) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Failed to start password reset";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().trim().min(1, "Token is required").max(128),
        newPassword: passwordSchema,
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = sqliteDb
            .prepare(
              `SELECT id, resetPasswordExpiresAt
               FROM users
               WHERE resetPasswordToken = ?`
            )
            .get(input.token) as { id: number; resetPasswordExpiresAt: number | null } | undefined;

          if (!user || !user.resetPasswordExpiresAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired token" });
          }
          const expiresAtMs = new Date(user.resetPasswordExpiresAt).getTime();
          if (expiresAtMs < Date.now()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired token" });
          }
          const pwHash = hashPassword(input.newPassword);
          await updateUserPassword(user.id, pwHash);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions });
          return { success: true };
        } catch (error: unknown) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Failed to reset password";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
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

    searchCourses: publicProcedure
      .input(z.object({ query: z.string().trim().min(1, "Query is required") }))
      .query(async ({ input }) => {
        return sqliteDb
          .prepare(
            `SELECT courses.*
             FROM courses
             JOIN courses_fts ON courses.id = courses_fts.rowid
             WHERE courses_fts MATCH ?
             LIMIT 20`
          )
          .all(input.query);
      }),

    searchWithAI: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const courses = await searchCourses(input.query, input.limit);
        // Get related courses for better recommendations
        if (courses.length > 0) {
          const firstCourse = courses[0];
          const related = await findRelatedCourses(firstCourse.id, Math.min(5, input.limit - courses.length));
          const relatedCourseIds = new Set(related.map(r => r.courseId));
          // Add related courses that aren't already in results
          const similarCourses = await getAllCourses(100);
          const additionalCourses = similarCourses
            .filter(c => relatedCourseIds.has(c.id) && !courses.find(course => course.id === c.id))
            .slice(0, Math.max(0, input.limit - courses.length));
          return [...courses, ...additionalCourses];
        }
        return courses;
      }),

    byCategory: publicProcedure
      .input(z.object({ category: z.string(), limit: z.number().default(20) }))
      .query(async ({ input }) => getCoursesByCategory(input.category, input.limit)),

    topRated: publicProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => getTopRatedCourses(input.limit)),

    platformRatings: publicProcedure
      .input(z.object({ courseId: z.number() }))
      .query(async ({ input }) => getPlatformRatingsForCourse(input.courseId)),

    getCoursePlatforms: publicProcedure
      .input(z.object({ courseId: z.number().int().positive() }))
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
    learningPaths: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getUserLearningPaths(ctx.user.id);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load learning paths";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
    update: protectedProcedure
      .input(z.object({
        skills: text50Array.optional(),
        interests: text50Array.optional(),
        learningGoals: text50Array.optional(),
        preferredDifficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        learningStyle: z.string().trim().max(100, "Must be 100 characters or fewer").optional(),
        bio: text500.optional(),
        onboardingCompleted: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const profile = await getUserProfile(ctx.user.id);
          const updated = {
            ...profile,
            skills: input.skills ? JSON.stringify(input.skills) : profile?.skills,
            interests: input.interests ? JSON.stringify(input.interests) : profile?.interests,
            learningGoals: input.learningGoals ? JSON.stringify(input.learningGoals) : profile?.learningGoals,
            preferredDifficulty: input.preferredDifficulty || profile?.preferredDifficulty,
            learningStyle: input.learningStyle || profile?.learningStyle,
            bio: input.bio || profile?.bio,
            onboardingCompletedAt: input.onboardingCompleted ? new Date() : profile?.onboardingCompletedAt,
          };
          return upsertUserProfile(ctx.user.id, updated);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to update profile";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
  }),

  bookmarks: router({
    list: protectedProcedure.query(async ({ ctx }) => getUserBookmarks(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({
        courseId: z.number().int().positive(),
        notes: text500.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await addBookmark(ctx.user.id, input.courseId, input.notes);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to add bookmark";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
    remove: protectedProcedure
      .input(z.object({ courseId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await removeBookmark(ctx.user.id, input.courseId);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to remove bookmark";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
  }),

  enrollment: router({
    enrolledCourses: protectedProcedure.query(async ({ ctx }) => getUserEnrolledCourses(ctx.user.id)),
    enroll: protectedProcedure
      .input(z.object({ courseId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await recordCourseInteraction(ctx.user.id, input.courseId, "started");
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to enroll";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
    recordInteraction: protectedProcedure
      .input(z.object({
        courseId: z.number().int().positive(),
        interactionType: z.enum(["viewed", "started", "completed", "rated", "bookmarked"]),
        rating: z.number().int().min(0).max(500).optional(),
        timeSpent: z.number().int().min(0).max(60 * 60 * 24).optional(),
        completionPercentage: z.number().int().min(0).max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await recordCourseInteraction(
            ctx.user.id,
            input.courseId,
            input.interactionType,
            input.rating,
            input.timeSpent,
            input.completionPercentage
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to record interaction";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
    getInteractions: protectedProcedure.query(async ({ ctx }) => getUserCourseInteractions(ctx.user.id)),
  }),

  recommendations: recommendationsRouter,

  chat: router({
    createSession: protectedProcedure
      .input(z.object({ title: z.string().trim().max(120, "Title must be 120 characters or fewer").optional() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await createChatSession(ctx.user.id, input.title);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to create session";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    getSessions: protectedProcedure
      .query(async ({ ctx }) => getChatSessions(ctx.user.id)),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .query(async ({ input }) => getChatMessages(input.sessionId)),

    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number().int().positive(),
        message: z.string().trim().min(1, "Message cannot be empty").max(500, "Message must be 500 characters or fewer"),
        relatedCourseIds: z.array(z.number().int().positive()).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Save user message
          await addChatMessage(input.sessionId, ctx.user.id, "user", input.message, input.relatedCourseIds);

          // Generate AI response based on message
          const assistantResponse = await generateAIResponse(input.message, input.relatedCourseIds || []);

          // Save assistant message
          return addChatMessage(
            input.sessionId,
            ctx.user.id,
            "assistant",
            assistantResponse.message,
            assistantResponse.courseIds
          );
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to send message";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        try {
          await deleteChatSession(input.sessionId);
          return { success: true };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to delete session";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
  }),

  admin: router({
    getAdminDashboardStats: adminProcedure.query(async () => {
      try {
        const totalUsers = sqliteDb.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
        const activeUsers = sqliteDb.prepare("SELECT COUNT(*) as count FROM users WHERE isActive = 1 AND isBanned = 0").get() as { count: number };
        const bannedUsers = sqliteDb.prepare("SELECT COUNT(*) as count FROM users WHERE isBanned = 1").get() as { count: number };
        const totalCourses = sqliteDb.prepare("SELECT COUNT(*) as count FROM courses").get() as { count: number };
        const totalInteractions = sqliteDb.prepare("SELECT COUNT(*) as count FROM courseInteractions").get() as { count: number };
        const totalBookmarks = sqliteDb.prepare("SELECT COUNT(*) as count FROM bookmarks").get() as { count: number };
        const newUsersThisWeek = sqliteDb.prepare(
          "SELECT COUNT(*) as count FROM users WHERE createdAt >= ?"
        ).get(Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60) as { count: number };
        const topCategories = sqliteDb.prepare(
          `SELECT category, COUNT(*) as count
           FROM courses
           GROUP BY category
           ORDER BY count DESC
           LIMIT 5`
        ).all() as Array<{ category: string; count: number }>;

        return {
          totalUsers: totalUsers.count,
          activeUsers: activeUsers.count,
          bannedUsers: bannedUsers.count,
          totalCourses: totalCourses.count,
          totalInteractions: totalInteractions.count,
          totalBookmarks: totalBookmarks.count,
          newUsersThisWeek: newUsersThisWeek.count,
          topCategories,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load admin stats";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

    getAllUsers: adminProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(5).max(100).default(20),
        search: z.string().trim().max(200).optional(),
        role: z.enum(["user", "admin"]).optional(),
        status: z.enum(["active", "banned"]).optional(),
      }))
      .query(async ({ input }) => {
        try {
          const offset = (input.page - 1) * input.limit;
          const filters: string[] = [];
          const params: Array<string | number> = [];

          if (input.search) {
            filters.push("(users.name LIKE ? OR users.email LIKE ?)");
            params.push(`%${input.search}%`, `%${input.search}%`);
          }
          if (input.role) {
            filters.push("users.role = ?");
            params.push(input.role);
          }
          if (input.status === "active") {
            filters.push("users.isBanned = 0 AND users.isActive = 1");
          }
          if (input.status === "banned") {
            filters.push("users.isBanned = 1");
          }

          const whereSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

          const totalRow = sqliteDb.prepare(
            `SELECT COUNT(*) as count FROM users ${whereSql}`
          ).get(...params) as { count: number };

          const usersRows = sqliteDb.prepare(
            `SELECT users.*, userProfiles.skills, userProfiles.interests, userProfiles.learningGoals,
                    userProfiles.preferredDifficulty, userProfiles.learningStyle,
                    (SELECT COUNT(*) FROM userProgress WHERE userProgress.userId = users.id) as progressCount,
                    (SELECT MAX(loginAt) FROM userLoginHistory WHERE userLoginHistory.userId = users.id) as lastLoginAt
             FROM users
             LEFT JOIN userProfiles ON userProfiles.userId = users.id
             ${whereSql}
             ORDER BY users.createdAt DESC
             LIMIT ? OFFSET ?`
          ).all(...params, input.limit, offset);

          return {
            items: usersRows,
            total: totalRow.count,
            page: input.page,
            limit: input.limit,
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to load users";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    getUserDetail: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .query(async ({ input }) => {
        try {
          const user = sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(input.userId);
          if (!user) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
          }
          const profile = sqliteDb.prepare("SELECT * FROM userProfiles WHERE userId = ?").get(input.userId);
          const learningPaths = sqliteDb.prepare("SELECT * FROM userLearningPaths WHERE userId = ?").all(input.userId);
          const progress = sqliteDb.prepare(
            `SELECT userProgress.*, courses.title as courseTitle
             FROM userProgress
             LEFT JOIN courses ON courses.id = userProgress.courseId
             WHERE userProgress.userId = ?`
          ).all(input.userId);
          const interactions = sqliteDb.prepare(
            `SELECT courseInteractions.*, courses.title as courseTitle
             FROM courseInteractions
             LEFT JOIN courses ON courses.id = courseInteractions.courseId
             WHERE courseInteractions.userId = ?
             ORDER BY courseInteractions.timestamp DESC`
          ).all(input.userId);
          const bookmarks = sqliteDb.prepare(
            `SELECT bookmarks.*, courses.title as courseTitle
             FROM bookmarks
             LEFT JOIN courses ON courses.id = bookmarks.courseId
             WHERE bookmarks.userId = ?
             ORDER BY bookmarks.createdAt DESC`
          ).all(input.userId);
          const loginHistory = sqliteDb.prepare(
            `SELECT * FROM userLoginHistory WHERE userId = ? ORDER BY loginAt DESC LIMIT 20`
          ).all(input.userId);

          return { user, profile, learningPaths, progress, interactions, bookmarks, loginHistory };
        } catch (error: unknown) {
          if (error instanceof TRPCError) throw error;
          const message = error instanceof Error ? error.message : "Failed to load user details";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    banUser: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        reason: z.string().trim().min(3).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          sqliteDb.prepare(
            "UPDATE users SET isBanned = 1, adminNotes = ? WHERE id = ?"
          ).run(input.reason, input.userId);
          await addAdminActivity(ctx.user.id, "ban_user", input.userId, null, input.reason);
          return { success: true };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to ban user";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    unbanUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          sqliteDb.prepare("UPDATE users SET isBanned = 0 WHERE id = ?").run(input.userId);
          await addAdminActivity(ctx.user.id, "unban_user", input.userId, null, null);
          return { success: true };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to unban user";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          sqliteDb.prepare("DELETE FROM users WHERE id = ?").run(input.userId);
          await addAdminActivity(ctx.user.id, "delete_user", input.userId, null, null);
          return { success: true };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to delete user";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    adminResetUserPassword: adminProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        newPassword: passwordSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const pwHash = hashPassword(input.newPassword);
          await updateUserPassword(input.userId, pwHash);
          await addAdminActivity(ctx.user.id, "reset_password", input.userId, null, "Admin reset password");
          return { success: true };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to reset password";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    getAllCourses: adminProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(5).max(100).default(20),
        search: z.string().trim().max(200).optional(),
        category: z.string().trim().max(120).optional(),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      }))
      .query(async ({ input }) => {
        try {
          const offset = (input.page - 1) * input.limit;
          const filters: string[] = [];
          const params: Array<string | number> = [];

          if (input.search) {
            filters.push("(title LIKE ? OR description LIKE ?)");
            params.push(`%${input.search}%`, `%${input.search}%`);
          }
          if (input.category) {
            filters.push("category = ?");
            params.push(input.category);
          }
          if (input.difficulty) {
            filters.push("difficulty = ?");
            params.push(input.difficulty);
          }

          const whereSql = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

          const totalRow = sqliteDb.prepare(
            `SELECT COUNT(*) as count FROM courses ${whereSql}`
          ).get(...params) as { count: number };

          const coursesRows = sqliteDb.prepare(
            `SELECT
                courses.*,
                (SELECT COUNT(*) FROM courseInteractions WHERE courseInteractions.courseId = courses.id) as interactionCount,
                (SELECT COALESCE(AVG(completionPercentage), 0) FROM courseInteractions WHERE courseInteractions.courseId = courses.id) as avgCompletionRate
             FROM courses
             ${whereSql}
             ORDER BY courses.createdAt DESC
             LIMIT ? OFFSET ?`
          ).all(...params, input.limit, offset);

          const enriched = coursesRows.map((course: any) => {
            const topUsers = sqliteDb.prepare(
              `SELECT users.id, users.name, COUNT(*) as interactions
               FROM courseInteractions
               JOIN users ON users.id = courseInteractions.userId
               WHERE courseInteractions.courseId = ?
               GROUP BY users.id
               ORDER BY interactions DESC
               LIMIT 3`
            ).all(course.id);
            return { ...course, topUsers };
          });

          return {
            items: enriched,
            total: totalRow.count,
            page: input.page,
            limit: input.limit,
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to load courses";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    getSystemStats: adminProcedure.query(async () => {
      try {
        const pageCount = sqliteDb.pragma("page_count", { simple: true }) as number;
        const pageSize = sqliteDb.pragma("page_size", { simple: true }) as number;
        const dbSize = pageCount * pageSize;
        const interactionsPerDay = sqliteDb.prepare(
          `SELECT strftime('%Y-%m-%d', timestamp, 'unixepoch') as day, COUNT(*) as count
           FROM courseInteractions
           WHERE timestamp >= ?
           GROUP BY day
           ORDER BY day ASC`
        ).all(Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60);
        const topBookmarked = sqliteDb.prepare(
          `SELECT courses.id, courses.title, COUNT(*) as count
           FROM bookmarks
           JOIN courses ON courses.id = bookmarks.courseId
           GROUP BY courses.id
           ORDER BY count DESC
           LIMIT 5`
        ).all();

        return {
          dbSize,
          interactionsPerDay,
          topBookmarked,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load system stats";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

    getAdminActivityLog: adminProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(5).max(100).default(20),
      }))
      .query(async ({ input }) => {
        try {
          const offset = (input.page - 1) * input.limit;
          const totalRow = sqliteDb.prepare("SELECT COUNT(*) as count FROM adminActivityLog").get() as { count: number };
          const items = sqliteDb.prepare(
            `SELECT adminActivityLog.*, users.name as adminName
             FROM adminActivityLog
             LEFT JOIN users ON users.id = adminActivityLog.adminId
             ORDER BY performedAt DESC
             LIMIT ? OFFSET ?`
          ).all(input.limit, offset);

          return { items, total: totalRow.count, page: input.page, limit: input.limit };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to load activity log";
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
  }),
});

/**
 * Generate AI response for chat messages using real AI API
 * Uses OpenAI, Groq, or Anthropic to provide intelligent course recommendations
 */
async function generateAIResponse(userMessage: string, _courseIds: number[]): Promise<{ message: string; courseIds: number[] }> {
  try {
    // Search for relevant courses
    const courseResults = await searchCourses(userMessage, 15);
    const recommendedIds = courseResults.slice(0, 8).map(c => c.id);

    // Try to use real AI service
    let aiResponse = "";
    
    try {
      // Build system prompt with course information
      const courseSummary = courseResults.slice(0, 5)
        .map(c => `- ${c.title} (${c.category}, ${c.difficulty})`)
        .join("\n");

      const systemPrompt = `You are an expert AI learning assistant for an online course platform. Help users find the perfect courses.

Available course categories: Web Development, Data Science, Machine Learning, Mobile Development, Cloud Computing, Cybersecurity, Python, and more.

Rules:
- Be enthusiastic and encouraging
- Give specific course recommendations when relevant
- Consider skill level (beginner, intermediate, advanced)
- Be concise (max 200 words)
- Use emojis to be friendly
- Ask clarifying questions if needed`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userMessage },
      ];

      // Call AI service
      aiResponse = await aiService.generateResponse(messages);
      
    } catch (aiError) {
      console.warn("[AI] Service failed, using fallback response", aiError);
      // Fallback to smart keyword-based response
      aiResponse = generateSmartResponse(userMessage, courseResults);
    }

    return {
      message: aiResponse,
      courseIds: recommendedIds,
    };
  } catch (error) {
    console.error("[AI] Error generating response:", error);
    // Last resort fallback
    return {
      message: "I'm having trouble processing your request. Please try asking about a specific technology like 'Python courses' or 'React courses'.",
      courseIds: [],
    };
  }
}

/**
 * Smart fallback response when AI API is unavailable
 * Generates contextual, personalized responses based on user query
 */
function generateSmartResponse(userMessage: string, courseResults: SearchedCourse[]): string {
  const lower = userMessage.toLowerCase().trim();
  
  // Detect greetings and casual messages - respond naturally
  const greetings = ["hey", "hi", "hello", "sup", "yo", "how's", "how are", "what's up", "howdy", "greetings"];
  const isGreeting = greetings.some(g => lower.includes(g));
  
  if (isGreeting) {
    const responses = [
      "Hey there! 👋 What courses are you looking for today?",
      "Hello! 😊 I'm here to help you find the perfect course. What interests you?",
      "Hi! What kind of learning are you interested in? I can recommend courses!",
      "Hey! Ready to learn something new? Tell me what you're interested in!",
      "What's up! 🚀 I'm your learning assistant. What would you like to explore?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  
  // Detect casual questions
  if (lower === "help" || lower === "?" || lower === "what can you do") {
    return "I can help you find the perfect courses! Just tell me:\n• What technology you want to learn (e.g., 'Python', 'React')\n• Your skill level (beginner, intermediate, advanced)\n• What you're interested in (web development, data science, etc.)\n\nAsk me anything like 'best Python courses' or 'learn JavaScript for beginners'!";
  }
  
  // Extract search keywords from the user message
  const keywords = lower.split(/\s+/).filter(w => w.length > 2);
  
  if (courseResults.length === 0) {
    // Be more helpful when no results found
    return `Hmm, I didn't find courses for "${userMessage}". Try searching for technologies like Python, JavaScript, React, Node.js, Data Science, Machine Learning, or specific frameworks.`;
  }

  // Detect difficulty level preference
  const isBeginner = lower.includes("beginner") || lower.includes("start") || lower.includes("learn");
  const isAdvanced = lower.includes("advanced") || lower.includes("expert") || lower.includes("intermediate");
  
  // Filter results by difficulty if user specified
  let relevantCourses = courseResults;
  if (isBeginner) {
    relevantCourses = courseResults.filter(c => c.difficulty === "beginner");
    if (relevantCourses.length === 0) relevantCourses = courseResults;
  } else if (isAdvanced) {
    relevantCourses = courseResults.filter(c => c.difficulty === "advanced" || c.difficulty === "intermediate");
    if (relevantCourses.length === 0) relevantCourses = courseResults;
  }
  
  relevantCourses = relevantCourses.slice(0, 5);
  
  let response = "";
  
  // Detect what user is asking for and respond accordingly
  if (lower.includes("recommend") || lower.includes("best") || lower.includes("perfect")) {
    response = `Perfect! Here are my top recommendations for "${userMessage}":\n\n`;
    relevantCourses.forEach((c, i) => {
      response += `${i + 1}. **${c.title}** (${c.difficulty} - ${c.category})\n`;
    });
    response += `\nAll these courses have hands-on projects and certifications. Pick one and start learning!`;
  } 
  else if (lower.includes("what") && lower.includes("course")) {
    response = `Great question! For "${userMessage}", I'd recommend:\n\n`;
    relevantCourses.forEach((c, i) => {
      response += `${i + 1}. ${c.title}\n   Category: ${c.category} | Level: ${c.difficulty}\n`;
    });
    response += `\nThese are the best courses matching what you're looking for!`;
  }
  else if (lower.includes("learn")) {
    response = `Awesome! To learn ${userMessage}, check out these courses:\n\n`;
    relevantCourses.forEach((c, i) => {
      response += `${i + 1}. ${c.title}\n`;
    });
    response += `\nEach one is designed to take you from basics to advanced skills. Start with any of them!`;
  }
  else if (lower.includes("compare") || lower.includes("vs")) {
    response = `Here are courses related to "${userMessage}":\n\n`;
    relevantCourses.forEach((c, i) => {
      response += `${i + 1}. **${c.title}** - ${c.category} (${c.difficulty})\n`;
    });
    response += `\nCompare these options and pick the one that fits your goals best!`;
  }
  else {
    // Generic contextualized response
    const topCourse = relevantCourses[0];
    response = `For "${userMessage}", I found ${courseResults.length} courses. Here are the best ones:\n\n`;
    relevantCourses.forEach((c, i) => {
      response += `${i + 1}. ${c.title} (${c.difficulty})\n`;
    });
    response += `\nI especially recommend starting with "${topCourse.title}" - it covers exactly what you need!`;
  }

  return response;
}

export type AppRouter = typeof appRouter;
