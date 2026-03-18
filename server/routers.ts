import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  publicProcedure,
  protectedProcedure,
  publicRateLimitedProcedure,
  protectedRateLimitedProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import type { Course } from "../drizzle/schema";
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
  getUserFeedbackSignals,
  submitRecommendationFeedback,
  getUserRecommendationFeedbackSummary,
  getUserByEmail,
  createUser,
  updateUserPasswordHash,
  getUserBookmarks,
  addBookmark,
  removeBookmark,
  getPlatformRatingsForCourse,
  getSameCategoryCourseComparison,
  getTopRatedCourses,
  getAdminAnalyticsOverview,
  createChatSession,
  getChatSessions,
  getChatMessages,
  addChatMessage,
  deleteChatSession,
} from "./db";
import { contentBasedRecommendations, collaborativeRecommendations, popularityRecommendations, hybridRecommendations, learningPatternRecommendations } from "./ml/recommender";
import { findRelatedCourses, getAIPoweredSuggestions, getTrendingInCategory, getPrerequisiteCourses, getAdvancedCourses } from "./ml/ai-recommender";
import { sdk } from "./_core/sdk";
import { aiService } from "./_core/ai";
import { hashPassword, passwordNeedsUpgrade, verifyPassword } from "./_core/password";
import { logger } from "./_core/logger";

const authRegisterProcedure = publicRateLimitedProcedure("auth.register", {
  windowMs: 10 * 60 * 1000,
  maxRequests: 8,
});

const authLoginProcedure = publicRateLimitedProcedure("auth.login", {
  windowMs: 5 * 60 * 1000,
  maxRequests: 20,
});

const recReadProcedure = protectedRateLimitedProcedure("recommendations.read", {
  windowMs: 60 * 1000,
  maxRequests: 60,
});

const recWriteProcedure = protectedRateLimitedProcedure("recommendations.write", {
  windowMs: 60 * 1000,
  maxRequests: 20,
});

const recPublicProcedure = publicRateLimitedProcedure("recommendations.public", {
  windowMs: 60 * 1000,
  maxRequests: 45,
});

const idSchema = z.number().int().positive();
const offsetSchema = z.number().int().min(0).max(10_000).default(0);
const courseListLimitSchema = z.number().int().min(1).max(100).default(20);
const recommendationLimitSchema = z.number().int().min(1).max(20).default(10);
const compactLimitSchema = z.number().int().min(1).max(12).default(5);
const searchLimitSchema = z.number().int().min(1).max(50).default(20);
const searchQuerySchema = z.string().trim().min(2).max(120);
const categorySchema = z.string().trim().min(2).max(80);
const profileStringArraySchema = z.array(z.string().trim().min(1).max(50)).max(25);

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

type CachedAiSuggestionEntry = {
  value: Awaited<ReturnType<typeof getAIPoweredSuggestions>>;
  expiresAt: number;
};

const aiSuggestionCache = new Map<string, CachedAiSuggestionEntry>();
const AI_SUGGESTION_TTL_MS = 10 * 60 * 1000;

function getCachedAiSuggestions(key: string): CachedAiSuggestionEntry["value"] | null {
  const cached = aiSuggestionCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    aiSuggestionCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedAiSuggestions(key: string, value: CachedAiSuggestionEntry["value"]): void {
  aiSuggestionCache.set(key, {
    value,
    expiresAt: Date.now() + AI_SUGGESTION_TTL_MS,
  });
}

type LearningPathStep = {
  order: number;
  courseId: number;
  title: string;
  difficulty: string;
  stage: string;
  reason: string;
  estimatedHours: number;
};

type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

const quizQuestionSchema = z.object({
  question: z.string().min(8).max(260),
  options: z.array(z.string().min(1).max(120)).length(4),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(8).max(280),
});

const aiQuizSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1),
});

function difficultyRank(level: string | null | undefined): number {
  if (level === "beginner") return 0;
  if (level === "intermediate") return 1;
  return 2;
}

function buildLearningPath(target: Course, categoryCourses: Course[], maxSteps: number): LearningPathStep[] {
  const deduped = new Map<number, Course>();
  deduped.set(target.id, target);
  for (const course of categoryCourses) {
    deduped.set(course.id, course);
  }

  const ranked = Array.from(deduped.values()).sort((a, b) => {
    const aQuality = (a.rating || 0) * 0.6 + (a.reviewCount || 0) * 0.0004 + (a.learnerCount || 0) * 0.00001;
    const bQuality = (b.rating || 0) * 0.6 + (b.reviewCount || 0) * 0.0004 + (b.learnerCount || 0) * 0.00001;
    return bQuality - aQuality;
  });

  const selected: Course[] = [];
  const selectedIds = new Set<number>();

  const addByDifficulty = (difficulty: "beginner" | "intermediate" | "advanced", count: number) => {
    for (const course of ranked) {
      if (selected.length >= maxSteps) break;
      if (selectedIds.has(course.id)) continue;
      if (course.difficulty !== difficulty) continue;
      selected.push(course);
      selectedIds.add(course.id);
      if (count <= 1) break;
      count -= 1;
    }
  };

  if (target.difficulty === "beginner") {
    selected.push(target);
    selectedIds.add(target.id);
    addByDifficulty("intermediate", 2);
    addByDifficulty("advanced", 2);
  } else if (target.difficulty === "intermediate") {
    addByDifficulty("beginner", 1);
    selected.push(target);
    selectedIds.add(target.id);
    addByDifficulty("intermediate", 1);
    addByDifficulty("advanced", 2);
  } else {
    addByDifficulty("beginner", 1);
    addByDifficulty("intermediate", 2);
    selected.push(target);
    selectedIds.add(target.id);
    addByDifficulty("advanced", 1);
  }

  for (const course of ranked) {
    if (selected.length >= maxSteps) break;
    if (selectedIds.has(course.id)) continue;
    selected.push(course);
    selectedIds.add(course.id);
  }

  const ordered = selected
    .slice(0, maxSteps)
    .sort((a, b) => {
      const diff = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
      if (diff !== 0) return diff;
      return (b.rating || 0) - (a.rating || 0);
    });

  return ordered.map((course, index) => {
    const stage = index === 0
      ? "Foundation"
      : index === ordered.length - 1
        ? "Mastery"
        : "Progression";

    const reason = course.id === target.id
      ? "Target milestone based on your selected goal"
      : course.difficulty === "beginner"
        ? "Builds fundamentals needed for later modules"
        : course.difficulty === "intermediate"
          ? "Strengthens practical project skills"
          : "Advances you to expert-level depth";

    return {
      order: index + 1,
      courseId: course.id,
      title: course.title,
      difficulty: course.difficulty,
      stage,
      reason,
      estimatedHours: Math.max(1, Math.round((course.duration || 60) / 60)),
    };
  });
}

function parseCourseTags(rawTags: string | null | undefined): string[] {
  if (!rawTags) return [];

  try {
    const parsed = JSON.parse(rawTags);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
        .slice(0, 8);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return rawTags
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function parseAiJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || trimmed).trim();

  return JSON.parse(candidate);
}

function buildFallbackQuiz(course: Course, questionCount: number, focus?: string): QuizQuestion[] {
  const topic = (focus || course.category || "this topic").trim();
  const tags = parseCourseTags(course.tags);
  const primaryTag = tags[0] || topic;
  const secondaryTag = tags[1] || "core concepts";

  const templates: Array<Omit<QuizQuestion, "id">> = [
    {
      question: `What is the most important first step when starting ${topic}?`,
      options: [
        "Understand fundamentals and terminology",
        "Skip to advanced optimization",
        "Memorize every tool shortcut first",
        "Avoid hands-on practice",
      ],
      answerIndex: 0,
      explanation: `Strong fundamentals in ${topic} make advanced practice and troubleshooting significantly easier.`,
    },
    {
      question: `In ${course.title}, why is ${primaryTag} emphasized?`,
      options: [
        "It is a foundational concept used throughout later modules",
        "It only matters for final exams",
        "It replaces all other concepts",
        "It is optional in real projects",
      ],
      answerIndex: 0,
      explanation: `${primaryTag} is often foundational and reused across intermediate and advanced tasks.`,
    },
    {
      question: `Which practice best improves retention while learning ${secondaryTag}?`,
      options: [
        "Build small projects and review mistakes",
        "Only read theory once",
        "Avoid quizzes until the end",
        "Watch videos at 2x without notes",
      ],
      answerIndex: 0,
      explanation: "Active recall and project-based practice improve long-term retention and transfer of learning.",
    },
    {
      question: `What progression is usually most effective for ${course.difficulty} learners in ${topic}?`,
      options: [
        "Concepts -> guided exercises -> independent projects",
        "Independent projects only",
        "Advanced topics before basics",
        "Memorization before understanding",
      ],
      answerIndex: 0,
      explanation: "A scaffolded path from concepts to guided work to independent projects creates stable skill growth.",
    },
    {
      question: `How should you evaluate your progress in ${topic}?`,
      options: [
        "Track project outcomes, quiz performance, and concept clarity",
        "Only total study hours",
        "Only completion badges",
        "Only peer comparisons",
      ],
      answerIndex: 0,
      explanation: "Combining outcomes, assessments, and conceptual understanding provides a balanced view of progress.",
    },
  ];

  const questions: QuizQuestion[] = [];
  for (let i = 0; i < questionCount; i += 1) {
    const template = templates[i % templates.length];
    questions.push({
      id: i + 1,
      ...template,
    });
  }

  return questions;
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

    register: authRegisterProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
        password: z.string().min(8).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "An account with this email already exists",
          });
        }
        const pwHash = await hashPassword(input.password);
        const user = await createUser({ email: input.email, name: input.name, passwordHash: pwHash });
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }
        // Create session
        const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    login: authLoginProcedure
      .input(z.object({
        email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        const passwordIsValid = await verifyPassword(input.password, user.passwordHash);
        if (!passwordIsValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        if (passwordNeedsUpgrade(user.passwordHash)) {
          const upgradedHash = await hashPassword(input.password);
          await updateUserPasswordHash(user.id, upgradedHash);
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
      .input(z.object({
        limit: courseListLimitSchema,
        offset: offsetSchema,
      }))
      .query(async ({ input }) => getAllCourses(input.limit, input.offset)),

    getById: publicProcedure
      .input(z.object({ id: idSchema }))
      .query(async ({ input }) => getCourseById(input.id)),

    search: publicProcedure
      .input(z.object({
        query: searchQuerySchema,
        limit: searchLimitSchema,
      }))
      .query(async ({ input }) => searchCourses(input.query, input.limit)),

    searchWithAI: publicProcedure
      .input(z.object({
        query: searchQuerySchema,
        limit: searchLimitSchema,
      }))
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
      .input(z.object({
        category: categorySchema,
        limit: searchLimitSchema,
      }))
      .query(async ({ input }) => getCoursesByCategory(input.category, input.limit)),

    topRated: publicProcedure
      .input(z.object({ limit: searchLimitSchema }))
      .query(async ({ input }) => getTopRatedCourses(input.limit)),

    platformRatings: publicProcedure
      .input(z.object({ courseId: idSchema }))
      .query(async ({ input }) => getPlatformRatingsForCourse(input.courseId)),

    sameCategoryComparison: publicProcedure
      .input(z.object({
        courseId: idSchema,
        limit: z.number().int().min(2).max(12).default(6),
      }))
      .query(async ({ input }) => getSameCategoryCourseComparison(input.courseId, input.limit)),

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
        skills: profileStringArraySchema.optional(),
        interests: profileStringArraySchema.optional(),
        learningGoals: profileStringArraySchema.optional(),
        preferredDifficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
        learningStyle: z.string().trim().max(80).optional(),
        bio: z.string().trim().max(280).optional(),
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
      .input(z.object({
        courseId: idSchema,
        notes: z.string().trim().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => addBookmark(ctx.user.id, input.courseId, input.notes)),
    remove: protectedProcedure
      .input(z.object({ courseId: idSchema }))
      .mutation(async ({ ctx, input }) => removeBookmark(ctx.user.id, input.courseId)),
  }),

  enrollment: router({
    enrolledCourses: protectedProcedure.query(async ({ ctx }) => getUserEnrolledCourses(ctx.user.id)),
    enroll: protectedProcedure
      .input(z.object({ courseId: idSchema }))
      .mutation(async ({ ctx, input }) => recordCourseInteraction(ctx.user.id, input.courseId, "started")),
    recordInteraction: protectedProcedure
      .input(z.object({
        courseId: idSchema,
        interactionType: z.enum(["viewed", "started", "completed", "rated", "bookmarked"]),
        rating: z.number().int().min(0).max(500).optional(),
        timeSpent: z.number().int().min(0).max(60 * 60 * 12).optional(),
        completionPercentage: z.number().int().min(0).max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) =>
        recordCourseInteraction(ctx.user.id, input.courseId, input.interactionType, input.rating, input.timeSpent, input.completionPercentage)),
    getInteractions: protectedProcedure.query(async ({ ctx }) => getUserCourseInteractions(ctx.user.id)),
  }),

  recommendations: router({
    getForUser: recReadProcedure
      .input(z.object({ limit: recommendationLimitSchema }))
      .query(async ({ ctx, input }) => getUserRecommendations(ctx.user.id, input.limit)),

    generate: recWriteProcedure
      .input(z.object({ algorithm: z.enum(["content-based", "collaborative", "hybrid", "popularity", "learning-pattern"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        let recs: any[] = [];
        if (input.algorithm === "learning-pattern") recs = await learningPatternRecommendations(userId, 10);
        else if (input.algorithm === "collaborative") recs = await collaborativeRecommendations(userId, 10);
        else if (input.algorithm === "popularity") recs = await popularityRecommendations(userId, 10);
        else if (input.algorithm === "hybrid") recs = await hybridRecommendations(userId, 10);
        else if (input.algorithm === "content-based") recs = await contentBasedRecommendations(userId, 10);
        else recs = await learningPatternRecommendations(userId, 10);

        // Sparse profiles/interactions can produce zero ML recs in fresh environments.
        // Fall back to top-rated courses so the UI always has suggestions to show.
        if (recs.length === 0) {
          const fallbackCourses = await getTopRatedCourses(10);
          recs = fallbackCourses.map((course, index) => ({
            courseId: course.id,
            score: Math.max(0.6, Math.min(0.99, (course.rating || 0) / 500)),
            reason: `Top-rated pick in ${course.category}`,
            algorithm: input.algorithm || "learning-pattern",
            rank: index + 1,
          }));
        }

        const feedbackSignals = await getUserFeedbackSignals(userId);
        if (feedbackSignals.size > 0) {
          recs = recs
            .map((rec) => {
              const signal = feedbackSignals.get(rec.courseId) || 0;
              const adjustedScore = clampScore((rec.score || 0) + signal);

              let reason = rec.reason;
              if (signal >= 0.05) {
                reason = `${reason} | boosted from your past feedback`;
              } else if (signal <= -0.05) {
                reason = `${reason} | adjusted from your past feedback`;
              }

              return {
                ...rec,
                score: adjustedScore,
                reason,
              };
            })
            .sort((a, b) => b.score - a.score);
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const recsToSave = recs.map((rec, index) => ({
          userId, courseId: rec.courseId,
          score: Math.round(rec.score * 100), reason: rec.reason,
          algorithm: rec.algorithm || input.algorithm || "learning-pattern", rank: index + 1, expiresAt,
        }));
        await saveRecommendations(recsToSave);
        return recsToSave;
      }),

    submitFeedback: recWriteProcedure
      .input(z.object({
        recommendationId: idSchema,
        feedback: z.enum(["helpful", "not-helpful", "already-taken", "not-interested"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const saved = await submitRecommendationFeedback(ctx.user.id, input.recommendationId, input.feedback);
        if (!saved) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recommendation not found for this user",
          });
        }

        return {
          success: true,
          feedback: saved.feedback,
          recommendationId: saved.recommendationId,
        } as const;
      }),

    feedbackSummary: recReadProcedure
      .query(async ({ ctx }) => getUserRecommendationFeedbackSummary(ctx.user.id)),

    learningPath: recReadProcedure
      .input(z.object({
        targetCourseId: idSchema.optional(),
        goal: z.string().trim().min(2).max(120).optional(),
        steps: z.number().int().min(3).max(8).default(5),
      }))
      .query(async ({ ctx, input }) => {
        let targetCourse: Course | undefined;

        if (input.targetCourseId) {
          targetCourse = await getCourseById(input.targetCourseId);
        }

        if (!targetCourse && input.goal) {
          const matches = await searchCourses(input.goal, 1);
          targetCourse = matches[0];
        }

        if (!targetCourse) {
          const existingRecs = await getUserRecommendations(ctx.user.id, 1);
          targetCourse = existingRecs[0]?.course;
        }

        if (!targetCourse) return [];

        const categoryCourses = await getCoursesByCategory(targetCourse.category, 120);
        return buildLearningPath(targetCourse, categoryCourses, input.steps);
      }),

    generateQuiz: recWriteProcedure
      .input(z.object({
        courseId: idSchema,
        focus: z.string().trim().min(2).max(80).optional(),
        questionCount: z.number().int().min(3).max(10).default(5),
      }))
      .mutation(async ({ input }) => {
        const course = await getCourseById(input.courseId);
        if (!course) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Course not found",
          });
        }

        let questions = buildFallbackQuiz(course, input.questionCount, input.focus);

        try {
          const prompt = `Create a concise practice quiz for this course.
Course title: ${course.title}
Category: ${course.category}
Difficulty: ${course.difficulty}
Tags: ${parseCourseTags(course.tags).join(", ")}
Focus: ${input.focus || "general course understanding"}

Return STRICT JSON only in this shape:
{
  "questions": [
    {
      "question": "...",
      "options": ["option1", "option2", "option3", "option4"],
      "answerIndex": 0,
      "explanation": "..."
    }
  ]
}

Rules:
- exactly ${input.questionCount} questions
- 4 options each
- one correct option only
- keep questions practical and course-relevant`;

          const aiRaw = await aiService.generateResponse([
            {
              role: "system" as const,
              content: "You generate valid JSON learning quizzes.",
            },
            {
              role: "user" as const,
              content: prompt,
            },
          ]);

          const parsed = parseAiJsonObject(aiRaw);
          const validated = aiQuizSchema.parse(parsed);
          questions = validated.questions.slice(0, input.questionCount).map((question, index) => ({
            id: index + 1,
            ...question,
          }));
        } catch {
          // Use deterministic fallback quiz when AI is unavailable or returns invalid JSON.
        }

        return {
          courseId: course.id,
          courseTitle: course.title,
          generatedAt: new Date(),
          questions,
        };
      }),

    relatedCourses: recPublicProcedure
      .input(z.object({
        courseId: idSchema,
        limit: compactLimitSchema,
      }))
      .query(async ({ input }) => {
        const related = await findRelatedCourses(input.courseId, input.limit);
        if (related.length === 0) return related;

        const allCourses = await getAllCourses(300);
        const courseMap = new Map(allCourses.map((course) => [course.id, course]));

        return related.map((item) => ({
          ...item,
          course: courseMap.get(item.courseId),
        }));
      }),

    aiSuggestions: recWriteProcedure
      .input(z.object({
        courseId: idSchema,
        limit: z.number().int().min(1).max(12).default(8),
      }))
      .query(async ({ ctx, input }) => {
        const cacheKey = `${ctx.user.id}:${input.courseId}:${input.limit}`;
        const cached = getCachedAiSuggestions(cacheKey);
        if (cached) return cached;

        const generated = await getAIPoweredSuggestions(ctx.user.id, input.courseId, input.limit);
        setCachedAiSuggestions(cacheKey, generated);
        return generated;
      }),

    trending: recPublicProcedure
      .input(z.object({
        category: categorySchema,
        limit: compactLimitSchema,
      }))
      .query(async ({ input }) => getTrendingInCategory(input.category, input.limit)),

    prerequisites: recPublicProcedure
      .input(z.object({
        courseId: idSchema,
        limit: z.number().int().min(1).max(8).default(3),
      }))
      .query(async ({ input }) => getPrerequisiteCourses(input.courseId, input.limit)),

    advanced: recPublicProcedure
      .input(z.object({
        courseId: idSchema,
        limit: z.number().int().min(1).max(8).default(3),
      }))
      .query(async ({ input }) => getAdvancedCourses(input.courseId, input.limit)),
  }),

  admin: router({
    analytics: adminProcedure.query(async () => getAdminAnalyticsOverview()),
  }),

  chat: router({
    createSession: protectedProcedure
      .input(z.object({ title: z.string().trim().max(120).optional() }))
      .mutation(async ({ ctx, input }) => createChatSession(ctx.user.id, input.title)),

    getSessions: protectedProcedure
      .query(async ({ ctx }) => getChatSessions(ctx.user.id)),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: idSchema }))
      .query(async ({ input }) => getChatMessages(input.sessionId)),

    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: idSchema,
        message: z.string().trim().min(1).max(1500),
        relatedCourseIds: z.array(idSchema).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
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
      }),

    deleteSession: protectedProcedure
      .input(z.object({ sessionId: idSchema }))
      .mutation(async ({ input }) => deleteChatSession(input.sessionId)),
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

      const courseContext = courseSummary
        ? `Top matching courses right now:\n${courseSummary}`
        : "No direct course matches were found for this query yet.";

      const systemPrompt = `You are an expert AI learning assistant for an online course platform. Help users find the perfect courses.

Available course categories: Web Development, Data Science, Machine Learning, Mobile Development, Cloud Computing, Cybersecurity, Python, and more.

${courseContext}

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

      logger.info("AI response generated", {
        preview: aiResponse.substring(0, 100),
        source: "chat",
      });
    } catch (aiError) {
      logger.warn("AI service failed, using fallback", {
        source: "chat",
        error: String(aiError),
      });
      // Fallback to smart keyword-based response
      aiResponse = generateSmartResponse(userMessage, courseResults);
    }

    return {
      message: aiResponse,
      courseIds: recommendedIds,
    };
  } catch (error) {
    logger.error("generateAIResponse failed", {
      error: String(error),
    });
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
function generateSmartResponse(userMessage: string, courseResults: any[]): string {
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
