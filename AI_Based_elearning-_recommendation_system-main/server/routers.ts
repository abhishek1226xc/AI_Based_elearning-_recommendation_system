import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { hashPassword } from "./utils/crypto";
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
} from "./db";
import { findRelatedCourses } from "./ml/ai-recommender";
import { sdk } from "./_core/sdk";
import { aiService } from "./_core/ai";
import { recommendationsRouter } from "./routers/recommendations";

type SearchedCourse = Awaited<ReturnType<typeof searchCourses>>[number];

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
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
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
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
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
        onboardingCompleted: z.boolean().optional(),
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
          onboardingCompletedAt: input.onboardingCompleted ? new Date() : profile?.onboardingCompletedAt,
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

  recommendations: recommendationsRouter,

  chat: router({
    createSession: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(async ({ ctx, input }) => createChatSession(ctx.user.id, input.title)),

    getSessions: protectedProcedure
      .query(async ({ ctx }) => getChatSessions(ctx.user.id)),

    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => getChatMessages(input.sessionId)),

    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        message: z.string(),
        relatedCourseIds: z.array(z.number()).optional(),
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
      .input(z.object({ sessionId: z.number() }))
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
