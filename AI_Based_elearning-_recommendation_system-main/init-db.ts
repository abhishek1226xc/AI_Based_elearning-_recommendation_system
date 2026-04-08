#!/usr/bin/env tsx
/**
 * Database initialization script
 * Run with: npx tsx init-db.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.resolve(import.meta.dirname, "data");

// Create data directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("✓ Created data directory");
}

const dbPath = path.join(dbDir, "elearning.db");
const dbExists = fs.existsSync(dbPath);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log(`✓ Connected to SQLite database at: ${dbPath}`);

// Create tables
const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    passwordHash TEXT,
    loginMethod TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    onboardingCompletedAt INTEGER,
    isActive INTEGER NOT NULL DEFAULT 1,
    isBanned INTEGER NOT NULL DEFAULT 0,
    lastLoginIp TEXT,
    resetPasswordToken TEXT,
    resetPasswordExpiresAt INTEGER,
    adminNotes TEXT,
    sessionInvalidatedAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS userProfiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE,
    skills TEXT,
    interests TEXT,
    learningGoals TEXT,
    preferredDifficulty TEXT DEFAULT 'intermediate',
    learningStyle TEXT,
    bio TEXT,
    onboardingCompletedAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    tags TEXT,
    instructor TEXT,
    duration INTEGER,
    platform TEXT DEFAULT 'Udemy',
    platformUrl TEXT,
    platformPrice TEXT DEFAULT 'Free',
    rating INTEGER DEFAULT 0,
    platformRating INTEGER DEFAULT 0,
    reviewCount INTEGER DEFAULT 0,
    learnerCount INTEGER DEFAULT 0,
    completionRate INTEGER DEFAULT 0,
    thumbnailUrl TEXT,
    contentUrl TEXT,
    lastSyncedAt INTEGER DEFAULT (unixepoch()),
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS courseInteractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    interactionType TEXT NOT NULL,
    rating INTEGER,
    timeSpent INTEGER,
    completionPercentage INTEGER DEFAULT 0,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS userProgress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    enrollmentDate INTEGER NOT NULL DEFAULT (unixepoch()),
    completionDate INTEGER,
    completionPercentage INTEGER DEFAULT 0,
    quizScores TEXT,
    lastAccessedAt INTEGER DEFAULT (unixepoch()),
    certificateIssued INTEGER DEFAULT 0,
    certificateUrl TEXT,
    notes TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS platformRatings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    courseId INTEGER NOT NULL,
    platform TEXT NOT NULL,
    rating INTEGER,
    reviewCount INTEGER DEFAULT 0,
    lastUpdated INTEGER NOT NULL DEFAULT (unixepoch()),
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    courseId INTEGER NOT NULL,
    score REAL,
    reason TEXT,
    generatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recommendationFeedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    recommendationId INTEGER NOT NULL,
    feedback TEXT,
    helpful INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recommendationId) REFERENCES recommendations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chatSessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chatMessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (sessionId) REFERENCES chatSessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS userLearningPaths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    pathName TEXT NOT NULL,
    description TEXT,
    courseIds TEXT NOT NULL,
    currentCourseIndex INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS userLoginHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    loginAt INTEGER NOT NULL DEFAULT (unixepoch()),
    ipAddress TEXT,
    userAgent TEXT,
    success INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS adminActivityLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    adminId INTEGER NOT NULL,
    action TEXT NOT NULL,
    targetUserId INTEGER,
    targetCourseId INTEGER,
    details TEXT,
    performedAt INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (adminId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (targetUserId) REFERENCES users(id),
    FOREIGN KEY (targetCourseId) REFERENCES courses(id)
  );

  CREATE INDEX IF NOT EXISTS idx_loginHistory_userId ON userLoginHistory(userId);
  CREATE INDEX IF NOT EXISTS idx_learningPaths_userId ON userLearningPaths(userId);
  CREATE INDEX IF NOT EXISTS idx_adminLog_adminId ON adminActivityLog(adminId);
`;

try {
  db.exec(schema);
  console.log("✓ Database schema initialized successfully");
} catch (error) {
  console.error("✗ Error initializing schema:", error);
  process.exit(1);
}

// Insert sample data if database is new
if (!dbExists) {
  console.log("\n📝 Seeding database with sample data...\n");

  const courses = [
    {
      title: "Introduction to JavaScript",
      description: "Learn the basics of JavaScript programming",
      category: "Programming",
      difficulty: "beginner",
      instructor: "John Doe",
      duration: 1440,
      platform: "Udemy",
      platformUrl: "https://udemy.com/course/javascript-intro",
      tags: JSON.stringify(["javascript", "web", "programming"]),
    },
    {
      title: "Advanced React Patterns",
      description: "Master advanced React patterns and best practices",
      category: "Web Development",
      difficulty: "advanced",
      instructor: "Jane Smith",
      duration: 2880,
      platform: "Coursera",
      platformUrl: "https://coursera.com/course/react-advanced",
      tags: JSON.stringify(["react", "advanced", "frontend"]),
    },
    {
      title: "Python for Data Science",
      description: "Complete guide to data science with Python",
      category: "Data Science",
      difficulty: "intermediate",
      instructor: "Mike Johnson",
      duration: 3600,
      platform: "edX",
      platformUrl: "https://edx.org/course/python-data-science",
      tags: JSON.stringify(["python", "data-science", "analytics"]),
    },
  ];

  const insertCourse = db.prepare(`
    INSERT INTO courses (
      title, description, category, difficulty, instructor, 
      duration, platform, platformUrl, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const course of courses) {
    insertCourse.run(
      course.title,
      course.description,
      course.category,
      course.difficulty,
      course.instructor,
      course.duration,
      course.platform,
      course.platformUrl,
      course.tags
    );
  }

  console.log(`✓ Added ${courses.length} sample courses`);
}

db.close();
console.log("\n✅ Database initialization complete!");
