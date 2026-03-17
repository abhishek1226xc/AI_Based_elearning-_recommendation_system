import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User profiles with learning preferences and goals
 */
export const userProfiles = sqliteTable("userProfiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  skills: text("skills"), // JSON array of skill strings
  interests: text("interests"), // JSON array of interest strings
  learningGoals: text("learningGoals"), // JSON array of goal strings
  preferredDifficulty: text("preferredDifficulty").default("intermediate"),
  learningStyle: text("learningStyle"),
  bio: text("bio"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

/**
 * Course catalog with metadata
 */
export const courses = sqliteTable("courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  difficulty: text("difficulty", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
  tags: text("tags"), // JSON array of tag strings
  instructor: text("instructor"),
  duration: integer("duration"), // in minutes
  platform: text("platform").default("Udemy"), // Source platform
  platformUrl: text("platformUrl"), // External course link
  platformPrice: text("platformPrice").default("Free"), // Price on platform
  rating: integer("rating").default(0), // 0-5 stars * 100 (aggregated)
  platformRating: integer("platformRating").default(0), // Rating on source platform * 100
  reviewCount: integer("reviewCount").default(0),
  learnerCount: integer("learnerCount").default(0), // External enrollment count
  completionRate: integer("completionRate").default(0),
  thumbnailUrl: text("thumbnailUrl"),
  contentUrl: text("contentUrl"),
  lastSyncedAt: integer("lastSyncedAt", { mode: "timestamp" }).default(sql`(unixepoch())`),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

/**
 * User-course interactions for tracking behavior
 */
export const courseInteractions = sqliteTable("courseInteractions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  interactionType: text("interactionType", { enum: ["viewed", "started", "completed", "rated", "bookmarked"] }).notNull(),
  rating: integer("rating"),
  timeSpent: integer("timeSpent"),
  completionPercentage: integer("completionPercentage").default(0),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type CourseInteraction = typeof courseInteractions.$inferSelect;
export type InsertCourseInteraction = typeof courseInteractions.$inferInsert;

/**
 * User progress tracking for enrolled courses
 */
export const userProgress = sqliteTable("userProgress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  enrollmentDate: integer("enrollmentDate", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  completionDate: integer("completionDate", { mode: "timestamp" }),
  completionPercentage: integer("completionPercentage").default(0),
  quizScores: text("quizScores"), // JSON array
  lastAccessedAt: integer("lastAccessedAt", { mode: "timestamp" }).default(sql`(unixepoch())`),
  status: text("status", { enum: ["enrolled", "in-progress", "completed", "dropped"] }).default("enrolled"),
  totalTimeSpent: integer("totalTimeSpent").default(0),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type UserProgressRecord = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

/**
 * Cached recommendations for performance
 */
export const recommendations = sqliteTable("recommendations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  score: integer("score"),
  reason: text("reason"),
  algorithm: text("algorithm", { enum: ["content-based", "collaborative", "hybrid", "popularity", "learning-pattern"] }).notNull(),
  rank: integer("rank"),
  generatedAt: integer("generatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;

/**
 * User feedback on recommendations
 */
export const recommendationFeedback = sqliteTable("recommendationFeedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  recommendationId: integer("recommendationId").notNull().references(() => recommendations.id, { onDelete: "cascade" }),
  feedback: text("feedback", { enum: ["helpful", "not-helpful", "already-taken", "not-interested"] }).notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type RecommendationFeedback = typeof recommendationFeedback.$inferSelect;
export type InsertRecommendationFeedback = typeof recommendationFeedback.$inferInsert;

/**
 * Cross-platform ratings for same course
 */
export const platformRatings = sqliteTable("platformRatings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // Udemy, Coursera, edX, etc.
  rating: integer("rating").default(0), // 0-500
  reviewCount: integer("reviewCount").default(0),
  price: text("price").default("Free"),
  url: text("url"),
  lastUpdated: integer("lastUpdated", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export type PlatformRating = typeof platformRatings.$inferSelect;
export type InsertPlatformRating = typeof platformRatings.$inferInsert;

/**
 * User bookmarks / saved courses
 */
export const bookmarks = sqliteTable("bookmarks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("courseId").notNull().references(() => courses.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type InsertBookmark = typeof bookmarks.$inferInsert;

/**
 * Chat sessions for AI learning assistant
 */
export const chatSessions = sqliteTable("chatSessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").default("Untitled Chat"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

/**
 * Chat messages within sessions
 */
export const chatMessages = sqliteTable("chatMessages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("sessionId").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  relatedCourseIds: text("relatedCourseIds"), // JSON array of related course IDs
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;