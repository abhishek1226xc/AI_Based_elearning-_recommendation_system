import { eq, and, desc, like, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import {
  InsertUser,
  users,
  courses,
  userProfiles,
  userProgress,
  courseInteractions,
  recommendations,
  platformRatings,
  bookmarks,
  chatSessions,
  chatMessages,
  userLearningPaths,
  userLoginHistory,
  adminActivityLog,
  type Course,
  type UserProfile,
  type UserProgressRecord,
  type CourseInteraction,
  type Recommendation,
  type ChatSession,
  type ChatMessage,
  type InsertChatMessage,
  type UserLearningPath,
  type UserLoginHistory,
  type AdminActivityLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

const isOwnerOpenId = (openId: string | null | undefined): boolean =>
  Boolean(ENV.ownerOpenId) && openId === ENV.ownerOpenId;

const isOwnerEmail = (email: string | null | undefined): boolean =>
  Boolean(ENV.ownerEmail) &&
  typeof email === "string" &&
  email.toLowerCase() === ENV.ownerEmail.toLowerCase();

const enforceRole = (identity: {
  openId?: string | null;
  email?: string | null;
}): "admin" | "user" => {
  if (isOwnerOpenId(identity.openId) || isOwnerEmail(identity.email)) {
    return "admin";
  }
  return "user";
};

let _db: ReturnType<typeof drizzle> | null = null;

const ensureUsersSchema = (sqlite: Database.Database) => {
  try {
    const columns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    if (columns.length === 0) return;
    const existing = new Set(columns.map(col => col.name));

    const addColumn = (name: string, type: string, defaultValue?: string) => {
      if (existing.has(name)) return;
      const defaultSql = defaultValue ? ` DEFAULT ${defaultValue}` : "";
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}${defaultSql}`);
    };

    addColumn("onboardingCompletedAt", "INTEGER");
    addColumn("isActive", "INTEGER", "1");
    addColumn("isBanned", "INTEGER", "0");
    addColumn("lastLoginIp", "TEXT");
    addColumn("resetPasswordToken", "TEXT");
    addColumn("resetPasswordExpiresAt", "INTEGER");
    addColumn("adminNotes", "TEXT");
    addColumn("sessionInvalidatedAt", "INTEGER");
  } catch (error) {
    console.warn("[Database] Failed to ensure users schema:", error);
  }
};

const ensureAdminTables = (sqlite: Database.Database) => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS userLearningPaths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pathName TEXT NOT NULL,
      description TEXT,
      courseIds TEXT NOT NULL,
      currentCourseIndex INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS userLoginHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      loginAt INTEGER NOT NULL DEFAULT (unixepoch()),
      ipAddress TEXT,
      userAgent TEXT,
      success INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS adminActivityLog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adminId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      targetUserId INTEGER REFERENCES users(id),
      targetCourseId INTEGER REFERENCES courses(id),
      details TEXT,
      performedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_loginHistory_userId ON userLoginHistory(userId);
    CREATE INDEX IF NOT EXISTS idx_learningPaths_userId ON userLearningPaths(userId);
    CREATE INDEX IF NOT EXISTS idx_adminLog_adminId ON adminActivityLog(adminId);
  `);
};

/**
 * Lazily create the drizzle SQLite instance.
 * The DB file is stored at ./data/elearning.db relative to project root.
 */
export function getDb() {
  if (!_db) {
    try {
      const dbDir = path.resolve(import.meta.dirname, '..', 'data');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      const dbPath = path.join(dbDir, 'elearning.db');
      const sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      ensureUsersSchema(sqlite);
      ensureAdminTables(sqlite);
      _db = drizzle(sqlite);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);

    if (existing.length > 0) {
      // Update existing user
      const updateSet: Record<string, unknown> = {};

      const textFields = ["name", "email", "loginMethod"] as const;
      for (const field of textFields) {
        if (user[field] !== undefined) {
          updateSet[field] = user[field] ?? null;
        }
      }

      if (user.lastSignedIn !== undefined) {
        updateSet.lastSignedIn = user.lastSignedIn;
      }
      updateSet.role = enforceRole({
        openId: user.openId,
        email: user.email ?? existing[0]?.email,
      });

      if (Object.keys(updateSet).length === 0) {
        updateSet.lastSignedIn = new Date();
      }
      updateSet.updatedAt = new Date();

      await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
    } else {
      // Insert new user
      const values: InsertUser = {
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        lastSignedIn: user.lastSignedIn ?? new Date(),
        role: enforceRole({ openId: user.openId, email: user.email }),
      };

      await db.insert(users).values(values);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function normalizeAdminRoles(): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  const admins = await db
    .select({
      id: users.id,
      openId: users.openId,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.role, "admin"));

  let demotedCount = 0;

  for (const admin of admins) {
    const enforced = enforceRole({ openId: admin.openId, email: admin.email });
    if (enforced !== "admin") {
      await db
        .update(users)
        .set({ role: "user", updatedAt: new Date() })
        .where(eq(users.id, admin.id));
      demotedCount += 1;
    }
  }

  return demotedCount;
}

// Course queries
export async function getAllCourses(limit: number = 100, offset: number = 0): Promise<Course[]> {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(courses)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(courses.learnerCount));
}

export async function getCourseById(courseId: number): Promise<Course | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function searchCourses(query: string, limit: number = 20): Promise<Course[]> {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(courses)
    .where(
      or(
        like(courses.title, `%${query}%`),
        like(courses.description, `%${query}%`),
        like(courses.category, `%${query}%`)
      )
    )
    .limit(limit);
}

export async function getCoursesByCategory(category: string, limit: number = 20): Promise<Course[]> {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(courses)
    .where(eq(courses.category, category))
    .limit(limit)
    .orderBy(desc(courses.learnerCount));
}

// User profile queries
export async function getUserProfile(userId: number): Promise<UserProfile | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserProfile(userId: number, profile: Partial<UserProfile>): Promise<UserProfile | undefined> {
  const db = getDb();
  if (!db) return undefined;

  try {
    const existing = await getUserProfile(userId);

    if (existing) {
      await db
        .update(userProfiles)
        .set({
          ...profile,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));
    } else {
      await db.insert(userProfiles).values({
        userId,
        ...profile,
      });
    }

    return getUserProfile(userId);
  } catch (error) {
    console.error("[Database] Failed to upsert user profile:", error);
    return undefined;
  }
}

// User progress queries
export async function getUserProgress(userId: number, courseId: number): Promise<UserProgressRecord | undefined> {
  const db = getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.courseId, courseId)))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserEnrolledCourses(userId: number): Promise<UserProgressRecord[]> {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(userProgress)
    .where(eq(userProgress.userId, userId))
    .orderBy(desc(userProgress.lastAccessedAt));
}

// Course interaction queries
export async function recordCourseInteraction(
  userId: number,
  courseId: number,
  interactionType: "viewed" | "started" | "completed" | "rated" | "bookmarked",
  rating?: number,
  timeSpent?: number,
  completionPercentage?: number
): Promise<CourseInteraction | undefined> {
  const db = getDb();
  if (!db) return undefined;

  try {
    await db.insert(courseInteractions).values({
      userId,
      courseId,
      interactionType,
      rating,
      timeSpent,
      completionPercentage,
    });

    return {
      id: 0,
      userId,
      courseId,
      interactionType,
      rating: rating || null,
      timeSpent: timeSpent || null,
      completionPercentage: completionPercentage || 0,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("[Database] Failed to record course interaction:", error);
    return undefined;
  }
}

export async function getUserCourseInteractions(userId: number): Promise<CourseInteraction[]> {
  const db = getDb();
  if (!db) return [];

  return db
    .select()
    .from(courseInteractions)
    .where(eq(courseInteractions.userId, userId))
    .orderBy(desc(courseInteractions.timestamp));
}

// Recommendation queries
export async function getUserRecommendations(userId: number, limit: number = 10): Promise<(Recommendation & { course?: Course })[]> {
  const db = getDb();
  if (!db) return [];

  const recs = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.userId, userId))
    .orderBy(desc(recommendations.rank))
    .limit(limit);

  // Fetch course details for each recommendation
  const courseIds = recs.map(r => r.courseId);
  if (courseIds.length === 0) return recs;

  const courseDetails = await db
    .select()
    .from(courses)
    .where(inArray(courses.id, courseIds));

  const courseMap = new Map(courseDetails.map(c => [c.id, c]));

  return recs.map(rec => ({
    ...rec,
    course: courseMap.get(rec.courseId),
  }));
}

export async function saveRecommendations(recs: Array<{
  userId: number;
  courseId: number;
  score: number;
  reason: string;
  algorithm: "content-based" | "collaborative" | "hybrid" | "popularity";
  rank: number;
  expiresAt: Date;
}>): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const userIds = Array.from(new Set(recs.map(r => r.userId)));
    for (const userId of userIds) {
      await db.delete(recommendations).where(eq(recommendations.userId, userId));
    }
    if (recs.length > 0) {
      await db.insert(recommendations).values(recs);
    }
  } catch (error) {
    console.error("[Database] Failed to save recommendations:", error);
  }
}

// ── Auth Functions ───────────────────────────────────────────────────
export async function getUserByEmail(email: string) {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: { email: string; name: string; passwordHash: string }) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const openId = `email-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    role: enforceRole({ openId, email: data.email }),
    lastSignedIn: new Date(),
    isActive: 1,
    isBanned: 0,
  });
  return getUserByOpenId(openId);
}

export async function setResetPasswordToken(userId: number, token: string | null, expiresAt: Date | null) {
  const db = getDb();
  if (!db) return;
  await db.update(users)
    .set({ resetPasswordToken: token, resetPasswordExpiresAt: expiresAt })
    .where(eq(users.id, userId));
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = getDb();
  if (!db) return;
  await db.update(users)
    .set({
      passwordHash,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
      sessionInvalidatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateUserLoginMeta(userId: number, ip: string | null) {
  const db = getDb();
  if (!db) return;
  await db.update(users)
    .set({ lastLoginIp: ip, lastSignedIn: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getUserLearningPaths(userId: number): Promise<UserLearningPath[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(userLearningPaths).where(eq(userLearningPaths.userId, userId));
}

export async function getUserLoginHistory(userId: number, limit = 20): Promise<UserLoginHistory[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(userLoginHistory)
    .where(eq(userLoginHistory.userId, userId))
    .orderBy(desc(userLoginHistory.loginAt))
    .limit(limit);
}

export async function addUserLoginHistory(
  userId: number,
  ipAddress: string | null,
  userAgent: string | null,
  success: number
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(userLoginHistory).values({
    userId,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    success,
  });
}

export async function addAdminActivity(
  adminId: number,
  action: string,
  targetUserId?: number | null,
  targetCourseId?: number | null,
  details?: string | null
): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.insert(adminActivityLog).values({
    adminId,
    action,
    targetUserId: targetUserId ?? null,
    targetCourseId: targetCourseId ?? null,
    details: details ?? null,
  });
}

// ── Bookmark Functions ───────────────────────────────────────────────
export async function getUserBookmarks(userId: number) {
  const db = getDb();
  if (!db) return [];
  const bmarks = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
  const courseIds = bmarks.map(b => b.courseId);
  if (courseIds.length === 0) return [];
  const courseDetails = await db.select().from(courses).where(inArray(courses.id, courseIds));
  const courseMap = new Map(courseDetails.map(c => [c.id, c]));
  return bmarks.map(b => ({ ...b, course: courseMap.get(b.courseId) }));
}

export async function addBookmark(userId: number, courseId: number, notes?: string) {
  const db = getDb();
  if (!db) return;
  // Check if already bookmarked
  const existing = await db.select().from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.courseId, courseId))).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(bookmarks).values({ userId, courseId, notes: notes || null });
  return { userId, courseId, notes };
}

export async function removeBookmark(userId: number, courseId: number) {
  const db = getDb();
  if (!db) return;
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.courseId, courseId)));
}

// ── Platform Rating Functions ────────────────────────────────────────
export async function getPlatformRatingsForCourse(courseId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(platformRatings).where(eq(platformRatings.courseId, courseId));
}

export async function getTopRatedCourses(limit = 20) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(courses).orderBy(desc(courses.rating)).limit(limit);
}

// ── Chat Functions ──────────────────────────────────────────────────
export async function createChatSession(userId: number, title?: string): Promise<ChatSession | undefined> {
  const db = getDb();
  if (!db) return undefined;
  try {
    const result = await db.insert(chatSessions).values({
      userId,
      title: title || "New Chat",
    });
    const session = await db.select().from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.createdAt))
      .limit(1);
    return session.length > 0 ? session[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to create chat session:", error);
    return undefined;
  }
}

export async function getChatSessions(userId: number): Promise<ChatSession[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
}

export async function getChatMessages(sessionId: number): Promise<ChatMessage[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt));
}

export async function addChatMessage(
  sessionId: number,
  userId: number,
  role: "user" | "assistant",
  content: string,
  relatedCourseIds?: number[]
): Promise<ChatMessage | undefined> {
  const db = getDb();
  if (!db) return undefined;
  try {
    const result = await db.insert(chatMessages).values({
      sessionId,
      userId,
      role,
      content,
      relatedCourseIds: relatedCourseIds ? JSON.stringify(relatedCourseIds) : null,
    });
    
    // Get the inserted message by its ID instead of querying by timestamp
    // This avoids race conditions where multiple messages have the same second-precision timestamp
    const insertedId = result.lastInsertRowid;
    if (!insertedId) {
      // Fallback: query by timestamp (less reliable but better than nothing)
      const message = await db.select().from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
      return message.length > 0 ? message[0] : undefined;
    }
    
    const message = await db.select().from(chatMessages)
      .where(eq(chatMessages.id, Number(insertedId)));
    return message.length > 0 ? message[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to add chat message:", error);
    return undefined;
  }
}

export async function deleteChatSession(sessionId: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  } catch (error) {
    console.error("[Database] Failed to delete chat session:", error);
  }
}
