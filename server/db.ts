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
  type User,
  type Course,
  type UserProfile,
  type UserProgressRecord,
  type CourseInteraction,
  type Recommendation,
  type PlatformRating,
  type ChatSession,
  type ChatMessage,
  type InsertChatMessage,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _dbConnectionError: unknown = null;
let _didLogDbConnectionError = false;

const inMemoryUsersByOpenId = new Map<string, User>();
const inMemoryOpenIdByEmail = new Map<string, string>();
let inMemoryUserIdSeq = 1;

type InMemoryBookmarkRecord = {
  id: number;
  userId: number;
  courseId: number;
  notes: string | null;
  createdAt: Date;
};

const inMemoryBookmarksByUserId = new Map<number, InMemoryBookmarkRecord[]>();
let inMemoryBookmarkIdSeq = 1;

type InMemoryUserInput = {
  openId: string;
  name?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin" | null;
  lastSignedIn?: Date | null;
};

function canUseInMemoryAuthFallback(): boolean {
  return !ENV.isProduction;
}

function canUseInMemoryBookmarkFallback(): boolean {
  return !ENV.isProduction;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function removeInMemoryEmailIndex(email: string | null | undefined): void {
  if (!email) return;
  inMemoryOpenIdByEmail.delete(normalizeEmail(email));
}

function upsertInMemoryUser(input: InMemoryUserInput): User {
  const now = new Date();
  const existing = inMemoryUsersByOpenId.get(input.openId);

  if (existing) {
    const nextEmail = input.email !== undefined ? input.email : existing.email;
    if (existing.email !== nextEmail) {
      removeInMemoryEmailIndex(existing.email);
    }

    const updated: User = {
      ...existing,
      name: input.name !== undefined ? input.name : existing.name,
      email: nextEmail,
      passwordHash: input.passwordHash !== undefined ? input.passwordHash : existing.passwordHash,
      loginMethod: input.loginMethod !== undefined ? input.loginMethod : existing.loginMethod,
      role: (input.role || existing.role || "user") as "user" | "admin",
      lastSignedIn: input.lastSignedIn || now,
      updatedAt: now,
    };

    inMemoryUsersByOpenId.set(updated.openId, updated);
    if (updated.email) {
      inMemoryOpenIdByEmail.set(normalizeEmail(updated.email), updated.openId);
    }
    return updated;
  }

  const created: User = {
    id: inMemoryUserIdSeq++,
    openId: input.openId,
    name: input.name ?? null,
    email: input.email ?? null,
    passwordHash: input.passwordHash ?? null,
    loginMethod: input.loginMethod ?? null,
    role: (input.role || (input.openId === ENV.ownerOpenId ? "admin" : "user")) as "user" | "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: input.lastSignedIn || now,
  };

  inMemoryUsersByOpenId.set(created.openId, created);
  if (created.email) {
    inMemoryOpenIdByEmail.set(normalizeEmail(created.email), created.openId);
  }
  return created;
}

function getInMemoryUserByEmail(email: string): User | undefined {
  const openId = inMemoryOpenIdByEmail.get(normalizeEmail(email));
  if (!openId) return undefined;
  return inMemoryUsersByOpenId.get(openId);
}

function getInMemoryCourseForBookmark(courseId: number): Course | undefined {
  return FALLBACK_COURSES.find((course) => course.id === courseId);
}

function getInMemoryUserBookmarks(userId: number): Array<InMemoryBookmarkRecord & { course?: Course }> {
  const bookmarksForUser = inMemoryBookmarksByUserId.get(userId) || [];

  return bookmarksForUser
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((bookmark) => ({
      ...bookmark,
      course: getInMemoryCourseForBookmark(bookmark.courseId),
    }));
}

function addInMemoryBookmark(userId: number, courseId: number, notes?: string): InMemoryBookmarkRecord {
  const bookmarksForUser = inMemoryBookmarksByUserId.get(userId) || [];
  const existing = bookmarksForUser.find((bookmark) => bookmark.courseId === courseId);
  if (existing) return existing;

  const created: InMemoryBookmarkRecord = {
    id: inMemoryBookmarkIdSeq++,
    userId,
    courseId,
    notes: notes || null,
    createdAt: new Date(),
  };

  bookmarksForUser.push(created);
  inMemoryBookmarksByUserId.set(userId, bookmarksForUser);
  return created;
}

function removeInMemoryBookmark(userId: number, courseId: number): void {
  const bookmarksForUser = inMemoryBookmarksByUserId.get(userId);
  if (!bookmarksForUser || bookmarksForUser.length === 0) return;

  inMemoryBookmarksByUserId.set(
    userId,
    bookmarksForUser.filter((bookmark) => bookmark.courseId !== courseId)
  );
}

const FALLBACK_DATE = new Date("2024-01-01T00:00:00.000Z");

function makeFallbackCourse(partial: {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags?: string | null;
  instructor?: string | null;
  duration?: number | null;
  platform?: string | null;
  platformUrl?: string | null;
  platformPrice?: string | null;
  rating?: number | null;
  platformRating?: number | null;
  reviewCount?: number | null;
  learnerCount?: number | null;
  completionRate?: number | null;
}): Course {
  return {
    id: partial.id,
    title: partial.title,
    description: partial.description,
    category: partial.category,
    difficulty: partial.difficulty,
    tags: partial.tags ?? null,
    instructor: partial.instructor ?? null,
    duration: partial.duration ?? null,
    platform: partial.platform ?? "Udemy",
    platformUrl: partial.platformUrl ?? null,
    platformPrice: partial.platformPrice ?? "Free",
    rating: partial.rating ?? 0,
    platformRating: partial.platformRating ?? partial.rating ?? 0,
    reviewCount: partial.reviewCount ?? 0,
    learnerCount: partial.learnerCount ?? 0,
    completionRate: partial.completionRate ?? 0,
    thumbnailUrl: null,
    contentUrl: null,
    lastSyncedAt: FALLBACK_DATE,
    createdAt: FALLBACK_DATE,
    updatedAt: FALLBACK_DATE,
  };
}

const FALLBACK_COURSES: Course[] = [
  makeFallbackCourse({
    id: 10001,
    title: "The Complete Web Development Bootcamp",
    description: "Build real-world full stack apps with HTML, CSS, JavaScript, Node.js, and React.",
    category: "Web Development",
    difficulty: "beginner",
    tags: JSON.stringify(["html", "css", "javascript", "react", "node"]),
    instructor: "Angela Yu",
    duration: 3600,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$12.99",
    rating: 470,
    reviewCount: 280000,
    learnerCount: 900000,
    completionRate: 66,
  }),
  makeFallbackCourse({
    id: 10002,
    title: "Machine Learning Specialization",
    description: "Learn supervised learning, model evaluation, and practical ML workflows.",
    category: "Machine Learning",
    difficulty: "intermediate",
    tags: JSON.stringify(["machine learning", "python", "scikit-learn"]),
    instructor: "Andrew Ng",
    duration: 5400,
    platform: "Coursera",
    platformUrl: "https://www.coursera.org/",
    platformPrice: "Subscription",
    rating: 490,
    reviewCount: 45000,
    learnerCount: 520000,
    completionRate: 45,
  }),
  makeFallbackCourse({
    id: 10003,
    title: "Python for Data Science",
    description: "Use NumPy, pandas, and visualization libraries to solve data science tasks.",
    category: "Data Science",
    difficulty: "intermediate",
    tags: JSON.stringify(["python", "data science", "pandas", "numpy"]),
    instructor: "Jose Portilla",
    duration: 1800,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$14.99",
    rating: 460,
    reviewCount: 120000,
    learnerCount: 680000,
    completionRate: 55,
  }),
  makeFallbackCourse({
    id: 10004,
    title: "Deep Learning Specialization",
    description: "Build neural networks, CNNs, and sequence models with practical AI projects.",
    category: "Artificial Intelligence",
    difficulty: "advanced",
    tags: JSON.stringify(["deep learning", "neural networks", "tensorflow"]),
    instructor: "Andrew Ng",
    duration: 4800,
    platform: "Coursera",
    platformUrl: "https://www.coursera.org/",
    platformPrice: "Subscription",
    rating: 485,
    reviewCount: 38000,
    learnerCount: 420000,
    completionRate: 38,
  }),
  makeFallbackCourse({
    id: 10005,
    title: "AWS Certified Solutions Architect",
    description: "Design secure and scalable cloud systems on AWS with hands-on labs.",
    category: "Cloud Computing",
    difficulty: "intermediate",
    tags: JSON.stringify(["aws", "cloud", "architecture", "devops"]),
    instructor: "Stephane Maarek",
    duration: 1620,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$14.99",
    rating: 475,
    reviewCount: 185000,
    learnerCount: 920000,
    completionRate: 72,
  }),
  makeFallbackCourse({
    id: 10006,
    title: "Docker and Kubernetes Practical Guide",
    description: "Containerize apps and deploy production workloads with Docker and Kubernetes.",
    category: "DevOps",
    difficulty: "intermediate",
    tags: JSON.stringify(["docker", "kubernetes", "containers", "ci/cd"]),
    instructor: "Maximilian Schwarzmuller",
    duration: 1380,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$14.99",
    rating: 470,
    reviewCount: 38000,
    learnerCount: 280000,
    completionRate: 65,
  }),
  makeFallbackCourse({
    id: 10007,
    title: "Cybersecurity Fundamentals",
    description: "Understand common attack vectors and foundational defensive security practices.",
    category: "Cybersecurity",
    difficulty: "beginner",
    tags: JSON.stringify(["security", "networking", "threat modeling"]),
    instructor: "University of Maryland",
    duration: 1200,
    platform: "Coursera",
    platformUrl: "https://www.coursera.org/",
    platformPrice: "Free",
    rating: 450,
    reviewCount: 14000,
    learnerCount: 300000,
    completionRate: 58,
  }),
  makeFallbackCourse({
    id: 10008,
    title: "Mobile App Development with React Native",
    description: "Ship cross-platform iOS and Android apps using React Native and Expo.",
    category: "Mobile Development",
    difficulty: "intermediate",
    tags: JSON.stringify(["react native", "mobile", "expo"]),
    instructor: "Stephen Grider",
    duration: 2100,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$12.99",
    rating: 455,
    reviewCount: 52000,
    learnerCount: 240000,
    completionRate: 61,
  }),
  makeFallbackCourse({
    id: 10009,
    title: "SQL and Database Design Masterclass",
    description: "Design relational schemas, write efficient SQL, and model production-grade databases.",
    category: "Database Design",
    difficulty: "intermediate",
    tags: JSON.stringify(["sql", "database", "postgres", "indexing"]),
    instructor: "Mosh Hamedani",
    duration: 1500,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$13.99",
    rating: 445,
    reviewCount: 41000,
    learnerCount: 190000,
    completionRate: 64,
  }),
  makeFallbackCourse({
    id: 10010,
    title: "System Design Fundamentals",
    description: "Learn to design scalable APIs, distributed systems, caching layers, and queues.",
    category: "Software Architecture",
    difficulty: "advanced",
    tags: JSON.stringify(["system design", "scalability", "microservices", "architecture"]),
    instructor: "ByteByteGo",
    duration: 1320,
    platform: "Coursera",
    platformUrl: "https://www.coursera.org/",
    platformPrice: "Subscription",
    rating: 465,
    reviewCount: 18000,
    learnerCount: 260000,
    completionRate: 42,
  }),
  makeFallbackCourse({
    id: 10011,
    title: "Computer Science for Programmers",
    description: "Build strong CS foundations: algorithms, complexity, memory, and networking basics.",
    category: "Computer Science",
    difficulty: "beginner",
    tags: JSON.stringify(["algorithms", "computer science", "big-o", "networking"]),
    instructor: "Harvard CS Team",
    duration: 2400,
    platform: "edX",
    platformUrl: "https://www.edx.org/",
    platformPrice: "Free",
    rating: 452,
    reviewCount: 26000,
    learnerCount: 350000,
    completionRate: 50,
  }),
  makeFallbackCourse({
    id: 10012,
    title: "Prompt Engineering for Developers",
    description: "Write reliable prompts, evaluate outputs, and build LLM-powered workflows.",
    category: "Artificial Intelligence",
    difficulty: "beginner",
    tags: JSON.stringify(["llm", "prompt engineering", "ai", "evaluation"]),
    instructor: "DeepLearning.AI",
    duration: 720,
    platform: "Coursera",
    platformUrl: "https://www.coursera.org/",
    platformPrice: "Free",
    rating: 458,
    reviewCount: 22000,
    learnerCount: 410000,
    completionRate: 70,
  }),
  makeFallbackCourse({
    id: 10013,
    title: "Data Structures and Algorithms in JavaScript",
    description: "Master interview-ready data structures and algorithms with practical coding drills.",
    category: "Computer Science",
    difficulty: "intermediate",
    tags: JSON.stringify(["dsa", "javascript", "interviews", "problem solving"]),
    instructor: "Colt Steele",
    duration: 1920,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$14.99",
    rating: 468,
    reviewCount: 71000,
    learnerCount: 500000,
    completionRate: 57,
  }),
  makeFallbackCourse({
    id: 10014,
    title: "Kubernetes for Production",
    description: "Run secure, observable, and resilient Kubernetes workloads in production environments.",
    category: "DevOps",
    difficulty: "advanced",
    tags: JSON.stringify(["kubernetes", "devops", "helm", "observability"]),
    instructor: "KodeKloud",
    duration: 1680,
    platform: "Pluralsight",
    platformUrl: "https://www.pluralsight.com/",
    platformPrice: "Subscription",
    rating: 462,
    reviewCount: 12500,
    learnerCount: 210000,
    completionRate: 49,
  }),
  makeFallbackCourse({
    id: 10015,
    title: "Google Cloud Associate Engineer Prep",
    description: "Prepare for GCP certification with networking, IAM, compute, and deployment labs.",
    category: "Cloud Computing",
    difficulty: "intermediate",
    tags: JSON.stringify(["gcp", "cloud", "certification", "devops"]),
    instructor: "Google Cloud Training",
    duration: 1560,
    platform: "Coursera",
    platformUrl: "https://www.coursera.org/",
    platformPrice: "Subscription",
    rating: 451,
    reviewCount: 9600,
    learnerCount: 175000,
    completionRate: 54,
  }),
  makeFallbackCourse({
    id: 10016,
    title: "Full-Stack TypeScript with React and Node",
    description: "Build end-to-end TypeScript apps with React, Express, APIs, and modern tooling.",
    category: "Web Development",
    difficulty: "intermediate",
    tags: JSON.stringify(["typescript", "react", "node", "full stack"]),
    instructor: "Maximilian Schwarzmuller",
    duration: 2280,
    platform: "Udemy",
    platformUrl: "https://www.udemy.com/",
    platformPrice: "$12.99",
    rating: 472,
    reviewCount: 59000,
    learnerCount: 430000,
    completionRate: 63,
  }),
  makeFallbackCourse({
    id: 10017,
    title: "YouTube Full Stack Project Build Series",
    description: "Build end-to-end portfolio projects with React, Node.js, PostgreSQL, authentication, and deployment.",
    category: "Web Development",
    difficulty: "intermediate",
    tags: JSON.stringify(["youtube", "react", "node", "postgres", "portfolio"]),
    instructor: "Coding in Public",
    duration: 2400,
    platform: "YouTube",
    platformUrl: "https://www.youtube.com/",
    platformPrice: "Free",
    rating: 448,
    reviewCount: 8500,
    learnerCount: 510000,
    completionRate: 52,
  }),
  makeFallbackCourse({
    id: 10018,
    title: "Responsive Web Design Certification",
    description: "Learn semantic HTML, modern CSS, accessibility, and responsive layouts with practical projects.",
    category: "Web Development",
    difficulty: "beginner",
    tags: JSON.stringify(["freecodecamp", "html", "css", "accessibility", "responsive"]),
    instructor: "freeCodeCamp",
    duration: 1800,
    platform: "freeCodeCamp",
    platformUrl: "https://www.freecodecamp.org/",
    platformPrice: "Free",
    rating: 454,
    reviewCount: 30000,
    learnerCount: 780000,
    completionRate: 62,
  }),
  makeFallbackCourse({
    id: 10019,
    title: "SQL Foundations and Relational Thinking",
    description: "Master SQL queries, joins, aggregation, and data modeling from beginner to intermediate level.",
    category: "Database Design",
    difficulty: "beginner",
    tags: JSON.stringify(["khan academy", "sql", "database", "joins", "analytics"]),
    instructor: "Khan Academy",
    duration: 1260,
    platform: "Khan Academy",
    platformUrl: "https://www.khanacademy.org/",
    platformPrice: "Free",
    rating: 442,
    reviewCount: 6200,
    learnerCount: 290000,
    completionRate: 67,
  }),
  makeFallbackCourse({
    id: 10020,
    title: "Introduction to Algorithms and Complexity",
    description: "Deep dive into algorithm design, asymptotic analysis, graph search, and dynamic programming.",
    category: "Computer Science",
    difficulty: "advanced",
    tags: JSON.stringify(["mit", "algorithms", "complexity", "graphs", "dynamic programming"]),
    instructor: "MIT OpenCourseWare",
    duration: 3000,
    platform: "MIT OpenCourseWare",
    platformUrl: "https://ocw.mit.edu/",
    platformPrice: "Free",
    rating: 468,
    reviewCount: 4100,
    learnerCount: 220000,
    completionRate: 39,
  }),
  makeFallbackCourse({
    id: 10021,
    title: "MLOps From Model to Production",
    description: "Learn model versioning, CI/CD for ML, monitoring drift, and reliable production deployment patterns.",
    category: "Machine Learning",
    difficulty: "advanced",
    tags: JSON.stringify(["mlops", "youtube", "deployment", "monitoring", "ci/cd"]),
    instructor: "MLOps Community",
    duration: 1500,
    platform: "YouTube",
    platformUrl: "https://www.youtube.com/",
    platformPrice: "Free",
    rating: 446,
    reviewCount: 5200,
    learnerCount: 180000,
    completionRate: 46,
  }),
  makeFallbackCourse({
    id: 10022,
    title: "Cloud Fundamentals for Beginners",
    description: "Understand cloud infrastructure, IAM, compute, storage, and networking with vendor-neutral labs.",
    category: "Cloud Computing",
    difficulty: "beginner",
    tags: JSON.stringify(["cloud", "foundations", "aws", "gcp", "azure"]),
    instructor: "Cloud Skills Boost",
    duration: 1080,
    platform: "YouTube",
    platformUrl: "https://www.youtube.com/",
    platformPrice: "Free",
    rating: 438,
    reviewCount: 3900,
    learnerCount: 205000,
    completionRate: 60,
  }),
  makeFallbackCourse({
    id: 10023,
    title: "DevOps Roadmap with Real Projects",
    description: "Practice Linux, Docker, CI/CD, Kubernetes, and observability with guided project milestones.",
    category: "DevOps",
    difficulty: "intermediate",
    tags: JSON.stringify(["devops", "youtube", "docker", "kubernetes", "jenkins"]),
    instructor: "DevOps Journey",
    duration: 1740,
    platform: "YouTube",
    platformUrl: "https://www.youtube.com/",
    platformPrice: "Free",
    rating: 452,
    reviewCount: 7600,
    learnerCount: 340000,
    completionRate: 55,
  }),
  makeFallbackCourse({
    id: 10024,
    title: "Statistics and Probability for Data Science",
    description: "Build intuition for distributions, hypothesis testing, confidence intervals, and experiment design.",
    category: "Data Science",
    difficulty: "beginner",
    tags: JSON.stringify(["statistics", "probability", "khan academy", "data science"]),
    instructor: "Khan Academy",
    duration: 1320,
    platform: "Khan Academy",
    platformUrl: "https://www.khanacademy.org/",
    platformPrice: "Free",
    rating: 444,
    reviewCount: 8900,
    learnerCount: 310000,
    completionRate: 64,
  }),
  makeFallbackCourse({
    id: 10025,
    title: "Data Analysis with Python Certification",
    description: "Use NumPy, pandas, and visualization tools to analyze real datasets and communicate insights.",
    category: "Data Science",
    difficulty: "intermediate",
    tags: JSON.stringify(["freecodecamp", "python", "pandas", "numpy", "analysis"]),
    instructor: "freeCodeCamp",
    duration: 1680,
    platform: "freeCodeCamp",
    platformUrl: "https://www.freecodecamp.org/",
    platformPrice: "Free",
    rating: 457,
    reviewCount: 12400,
    learnerCount: 365000,
    completionRate: 59,
  }),
  makeFallbackCourse({
    id: 10026,
    title: "React Performance and Architecture",
    description: "Optimize rendering, state flow, code splitting, and scalable component architecture in React apps.",
    category: "Web Development",
    difficulty: "advanced",
    tags: JSON.stringify(["react", "performance", "architecture", "youtube", "frontend"]),
    instructor: "Frontend Masters Channel",
    duration: 1200,
    platform: "YouTube",
    platformUrl: "https://www.youtube.com/",
    platformPrice: "Free",
    rating: 449,
    reviewCount: 4800,
    learnerCount: 145000,
    completionRate: 48,
  }),
  makeFallbackCourse({
    id: 10027,
    title: "AI with Python and Search",
    description: "Implement classical AI search, optimization, and machine learning techniques with Python projects.",
    category: "Artificial Intelligence",
    difficulty: "intermediate",
    tags: JSON.stringify(["edx", "ai", "python", "search", "optimization"]),
    instructor: "HarvardX",
    duration: 2160,
    platform: "edX",
    platformUrl: "https://www.edx.org/",
    platformPrice: "Free",
    rating: 463,
    reviewCount: 9700,
    learnerCount: 275000,
    completionRate: 44,
  }),
  makeFallbackCourse({
    id: 10028,
    title: "Practical Cybersecurity for Developers",
    description: "Learn secure coding, dependency scanning, authentication hardening, and web app threat defense.",
    category: "Cybersecurity",
    difficulty: "intermediate",
    tags: JSON.stringify(["cybersecurity", "secure coding", "owasp", "youtube"]),
    instructor: "Security Weekly",
    duration: 1140,
    platform: "YouTube",
    platformUrl: "https://www.youtube.com/",
    platformPrice: "Free",
    rating: 441,
    reviewCount: 3600,
    learnerCount: 132000,
    completionRate: 53,
  }),
];

function sortCoursesByLearners(coursesList: Course[]): Course[] {
  return [...coursesList].sort((a, b) => (b.learnerCount || 0) - (a.learnerCount || 0));
}

function sortCoursesByRating(coursesList: Course[]): Course[] {
  return [...coursesList].sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

function isFreeCourse(course: Course): boolean {
  const platform = (course.platform || "").toLowerCase();
  const price = (course.platformPrice || "").toLowerCase();
  return (
    price.includes("free") ||
    price.includes("$0") ||
    platform.includes("youtube") ||
    platform.includes("khan academy") ||
    platform.includes("freecodecamp") ||
    platform.includes("opencourseware")
  );
}

const PLATFORM_HOME_URLS: Record<string, string> = {
  Udemy: "https://www.udemy.com/",
  Coursera: "https://www.coursera.org/",
  edX: "https://www.edx.org/",
  YouTube: "https://www.youtube.com/",
  Pluralsight: "https://www.pluralsight.com/",
  "Khan Academy": "https://www.khanacademy.org/",
  freeCodeCamp: "https://www.freecodecamp.org/",
  "MIT OpenCourseWare": "https://ocw.mit.edu/",
};

function getDefaultPriceForPlatform(platform: string): string {
  if (
    platform === "YouTube" ||
    platform === "Khan Academy" ||
    platform === "freeCodeCamp" ||
    platform === "MIT OpenCourseWare"
  ) {
    return "Free";
  }

  if (platform === "Coursera" || platform === "Pluralsight") {
    return "Subscription";
  }

  if (platform === "Udemy") {
    return "$14.99";
  }

  if (platform === "edX") {
    return "Free";
  }

  return "Free";
}

function getCategoryPlatformCandidates(category: string): string[] {
  const normalized = category.toLowerCase();

  if (normalized.includes("web")) {
    return ["Udemy", "YouTube", "freeCodeCamp", "Coursera", "edX"];
  }

  if (normalized.includes("machine") || normalized.includes("artificial")) {
    return ["Coursera", "edX", "YouTube", "MIT OpenCourseWare", "Udemy"];
  }

  if (normalized.includes("data")) {
    return ["Coursera", "edX", "Khan Academy", "freeCodeCamp", "YouTube"];
  }

  if (normalized.includes("cloud") || normalized.includes("devops")) {
    return ["Udemy", "Pluralsight", "Coursera", "YouTube", "edX"];
  }

  if (normalized.includes("cyber")) {
    return ["Udemy", "Coursera", "edX", "YouTube", "Pluralsight"];
  }

  if (normalized.includes("computer") || normalized.includes("software") || normalized.includes("database")) {
    return ["Coursera", "edX", "MIT OpenCourseWare", "Udemy", "YouTube"];
  }

  return ["Coursera", "Udemy", "edX", "YouTube", "freeCodeCamp"];
}

function clampPlatformRating(rating: number): number {
  return Math.max(300, Math.min(500, Math.round(rating)));
}

function buildFallbackPlatformRatings(course: Course): PlatformRating[] {
  const basePlatform = course.platform || "";
  const baseRating = course.platformRating || course.rating || 440;
  const baseReviewCount = Math.max(1200, course.reviewCount || 1200);
  const now = new Date();

  const preferredPlatforms = getCategoryPlatformCandidates(course.category);
  const globalPlatforms = [
    "Coursera",
    "Udemy",
    "edX",
    "YouTube",
    "freeCodeCamp",
    "Khan Academy",
    "MIT OpenCourseWare",
    "Pluralsight",
  ];

  const candidates: string[] = [];
  for (const platform of [...preferredPlatforms, ...globalPlatforms]) {
    if (platform === basePlatform) continue;
    if (candidates.includes(platform)) continue;
    candidates.push(platform);
    if (candidates.length >= 4) break;
  }

  const ratingOffsets = [5, 1, -5, -10];
  const reviewFactors = [0.72, 0.56, 0.43, 0.35];

  return candidates.map((platform, index) => {
    const freePenalty = getDefaultPriceForPlatform(platform) === "Free" ? 2 : 0;
    return {
      id: -200000 - course.id * 10 - index,
      courseId: course.id,
      platform,
      rating: clampPlatformRating(baseRating + ratingOffsets[index] - freePenalty),
      reviewCount: Math.max(300, Math.round(baseReviewCount * reviewFactors[index])),
      price: getDefaultPriceForPlatform(platform),
      url: PLATFORM_HOME_URLS[platform] || course.platformUrl || null,
      lastUpdated: now,
    };
  });
}

function getFallbackCourses(limit?: number, offset?: number): Course[] {
  const sorted = sortCoursesByLearners(FALLBACK_COURSES);
  if (typeof limit === "number" && typeof offset === "number") {
    return sorted.slice(offset, offset + limit);
  }
  if (typeof limit === "number") {
    return sorted.slice(0, limit);
  }
  return sorted;
}

function searchFallbackCourses(query: string, limit: number): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return getFallbackCourses(limit, 0);
  return sortCoursesByLearners(FALLBACK_COURSES)
    .filter((course) => {
      const haystack = [course.title, course.description, course.category, course.tags || ""].join(" ").toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, limit);
}

function getFallbackRecommendations(
  userId: number,
  limit: number
): Array<Recommendation & { course?: Course }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const ratedCourses = sortCoursesByRating(FALLBACK_COURSES);
  const freePriority = ratedCourses.filter(isFreeCourse).slice(0, Math.min(4, limit));

  const selectedCourses: Course[] = [];
  const selectedIds = new Set<number>();

  for (const course of [...freePriority, ...ratedCourses]) {
    if (selectedIds.has(course.id)) continue;
    selectedIds.add(course.id);
    selectedCourses.push(course);
    if (selectedCourses.length >= limit) break;
  }

  return selectedCourses
    .map((course, index) => ({
      id: -100000 - index,
      userId,
      courseId: course.id,
      score: Math.max(60, Math.min(99, Math.round((course.rating || 0) / 5) + (isFreeCourse(course) ? 3 : 0))),
      reason: isFreeCourse(course)
        ? `High-quality free pick on ${course.platform}`
        : `Top-rated in ${course.category}`,
      algorithm: "hybrid",
      rank: index + 1,
      generatedAt: now,
      expiresAt,
      course,
    }));
}

/**
 * Lazily create the drizzle SQLite instance.
 * The DB file is stored at ./data/elearning.db relative to project root.
 */
export function getDb() {
  if (_db) {
    return _db;
  }

  const possibleDataDirs = Array.from(new Set([
    path.resolve(process.cwd(), 'data'),
    ...(typeof import.meta.dirname === "string"
      ? [
        path.resolve(import.meta.dirname, '..', 'data'),
        path.resolve(import.meta.dirname, '..', '..', 'data'),
      ]
      : []),
  ]));

  for (const dbDir of possibleDataDirs) {
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      const dbPath = path.join(dbDir, 'elearning.db');
      const sqlite = new Database(dbPath);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      _db = drizzle(sqlite);
      _dbConnectionError = null;
      _didLogDbConnectionError = false;
      return _db;
    } catch (error) {
      _dbConnectionError = error;
      _db = null;
    }
  }

  if (!_didLogDbConnectionError) {
    console.warn("[Database] Failed to connect to SQLite. Falling back where possible:", _dbConnectionError);
    _didLogDbConnectionError = true;
  }

  return null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getDb();
  if (!db) {
    if (canUseInMemoryAuthFallback()) {
      upsertInMemoryUser({
        openId: user.openId,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        loginMethod: user.loginMethod,
        role: user.role,
        lastSignedIn: user.lastSignedIn,
      });
      return;
    }

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
      if (user.role !== undefined) {
        updateSet.role = user.role;
      } else if (user.openId === ENV.ownerOpenId) {
        updateSet.role = 'admin';
      }

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
        role: user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user'),
      };

      await db.insert(users).values(values);
    }
  } catch (error) {
    if (canUseInMemoryAuthFallback()) {
      upsertInMemoryUser({
        openId: user.openId,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        loginMethod: user.loginMethod,
        role: user.role,
        lastSignedIn: user.lastSignedIn,
      });
      return;
    }

    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) {
    if (canUseInMemoryAuthFallback()) {
      return inMemoryUsersByOpenId.get(openId);
    }

    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] getUserByOpenId failed:", error);
    if (canUseInMemoryAuthFallback()) {
      return inMemoryUsersByOpenId.get(openId);
    }
    return undefined;
  }
}

// Course queries
export async function getAllCourses(limit: number = 100, offset: number = 0): Promise<Course[]> {
  const db = getDb();
  if (!db) return getFallbackCourses(limit, offset);

  try {
    const result = await db
      .select()
      .from(courses)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(courses.learnerCount));

    if (result.length > 0) return result;
    return getFallbackCourses(limit, offset);
  } catch (error) {
    console.error("[Database] getAllCourses failed, using fallback data:", error);
    return getFallbackCourses(limit, offset);
  }
}

export async function getCourseById(courseId: number): Promise<Course | undefined> {
  const db = getDb();
  const fallback = FALLBACK_COURSES.find((course) => course.id === courseId);
  if (!db) return fallback;

  try {
    const result = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return result.length > 0 ? result[0] : fallback;
  } catch (error) {
    console.error("[Database] getCourseById failed, using fallback data:", error);
    return fallback;
  }
}

export async function searchCourses(query: string, limit: number = 20): Promise<Course[]> {
  const db = getDb();
  const fallback = searchFallbackCourses(query, limit);
  if (!db) return fallback;

  try {
    const result = await db
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

    if (result.length > 0) return result;
    return fallback;
  } catch (error) {
    console.error("[Database] searchCourses failed, using fallback data:", error);
    return fallback;
  }
}

export async function getCoursesByCategory(category: string, limit: number = 20): Promise<Course[]> {
  const db = getDb();
  const normalizedCategory = category.trim().toLowerCase();
  const fallback = sortCoursesByLearners(FALLBACK_COURSES)
    .filter((course) => course.category.toLowerCase() === normalizedCategory)
    .slice(0, limit);
  if (!db) return fallback;

  try {
    const result = await db
      .select()
      .from(courses)
      .where(eq(courses.category, category))
      .limit(limit)
      .orderBy(desc(courses.learnerCount));

    if (result.length > 0) return result;
    return fallback;
  } catch (error) {
    console.error("[Database] getCoursesByCategory failed, using fallback data:", error);
    return fallback;
  }
}

export type SameCategoryCourseComparison = {
  courseId: number;
  title: string;
  category: string;
  platform: string;
  instructor: string | null;
  difficulty: Course["difficulty"];
  rating: number | null;
  reviewCount: number | null;
  platformPrice: string | null;
  platformUrl: string | null;
  learnerCount: number | null;
  completionRate: number | null;
  isCurrentCourse: boolean;
  comparisonScore: number;
};

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseCourseTags(rawTags: string | null | undefined): string[] {
  if (!rawTags) return [];

  try {
    const parsed = JSON.parse(rawTags);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).toLowerCase().trim())
        .filter((item) => item.length > 0);
    }
  } catch {
    // Fall through to comma-separated parsing.
  }

  return rawTags
    .split(",")
    .map((item) => item.toLowerCase().trim())
    .filter((item) => item.length > 0);
}

function toKeywordSet(text: string | null | undefined): Set<string> {
  if (!text) return new Set<string>();

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function keywordSimilarity(source: Set<string>, target: Set<string>): number {
  if (source.size === 0 || target.size === 0) return 0;

  let matches = 0;
  for (const token of Array.from(source)) {
    if (target.has(token)) matches += 1;
  }

  return clampUnit(matches / source.size);
}

function scoreComparisonCandidate(sourceCourse: Course, candidate: Course): number {
  const sourceTitleTokens = toKeywordSet(sourceCourse.title);
  const candidateTitleTokens = toKeywordSet(candidate.title);

  const sourceTags = new Set(parseCourseTags(sourceCourse.tags));
  const candidateTags = new Set(parseCourseTags(candidate.tags));

  const titleSimilarity = keywordSimilarity(sourceTitleTokens, candidateTitleTokens);
  const tagSimilarity = keywordSimilarity(sourceTags, candidateTags);
  const difficultyMatch = sourceCourse.difficulty === candidate.difficulty ? 1 : 0;
  const ratingScore = clampUnit((candidate.rating || 0) / 500);
  const reviewScore = clampUnit(Math.log10((candidate.reviewCount || 0) + 1) / 5);
  const learnerScore = clampUnit(Math.log10((candidate.learnerCount || 0) + 1) / 6);

  return clampUnit(
    titleSimilarity * 0.28 +
      tagSimilarity * 0.22 +
      difficultyMatch * 0.12 +
      ratingScore * 0.23 +
      reviewScore * 0.1 +
      learnerScore * 0.05
  );
}

function buildSameCategoryComparisonRows(
  sourceCourse: Course,
  coursePool: Course[],
  limit: number
): SameCategoryCourseComparison[] {
  const safeLimit = Math.max(2, Math.min(12, limit));
  const sourcePlatformKey = (sourceCourse.platform || "Unknown").trim().toLowerCase();

  const uniqueById = new Map<number, Course>();
  for (const course of coursePool) {
    uniqueById.set(course.id, course);
  }
  uniqueById.set(sourceCourse.id, sourceCourse);

  const candidates = Array.from(uniqueById.values())
    .filter((course) => course.id !== sourceCourse.id)
    .map((course) => ({
      course,
      score: scoreComparisonCandidate(sourceCourse, course),
      platformKey: (course.platform || "Unknown").trim().toLowerCase(),
    }))
    .sort((a, b) => b.score - a.score);

  const picked: Array<{ course: Course; score: number }> = [];
  const pickedCourseIds = new Set<number>();
  const pickedPlatformKeys = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.platformKey === sourcePlatformKey) continue;
    if (pickedPlatformKeys.has(candidate.platformKey)) continue;

    picked.push({ course: candidate.course, score: candidate.score });
    pickedCourseIds.add(candidate.course.id);
    pickedPlatformKeys.add(candidate.platformKey);

    if (picked.length >= safeLimit - 1) break;
  }

  if (picked.length < safeLimit - 1) {
    for (const candidate of candidates) {
      if (pickedCourseIds.has(candidate.course.id)) continue;

      picked.push({ course: candidate.course, score: candidate.score });
      pickedCourseIds.add(candidate.course.id);

      if (picked.length >= safeLimit - 1) break;
    }
  }

  const toRow = (
    course: Course,
    comparisonScore: number,
    isCurrentCourse: boolean
  ): SameCategoryCourseComparison => ({
    courseId: course.id,
    title: course.title,
    category: course.category,
    platform: course.platform || "Unknown",
    instructor: course.instructor,
    difficulty: course.difficulty,
    rating: course.rating,
    reviewCount: course.reviewCount,
    platformPrice: course.platformPrice,
    platformUrl: course.platformUrl,
    learnerCount: course.learnerCount,
    completionRate: course.completionRate,
    isCurrentCourse,
    comparisonScore: Math.round(clampUnit(comparisonScore) * 100) / 100,
  });

  return [
    toRow(sourceCourse, 1, true),
    ...picked.slice(0, safeLimit - 1).map(({ course, score }) => toRow(course, score, false)),
  ];
}

export async function getSameCategoryCourseComparison(
  courseId: number,
  limit: number = 6
): Promise<SameCategoryCourseComparison[]> {
  const db = getDb();
  const safeLimit = Math.max(2, Math.min(12, limit));
  const fallbackSource = FALLBACK_COURSES.find((course) => course.id === courseId);

  const buildFallback = (sourceCourse: Course) => {
    const fallbackPool = FALLBACK_COURSES.filter(
      (course) => course.category.toLowerCase() === sourceCourse.category.toLowerCase()
    );
    return buildSameCategoryComparisonRows(sourceCourse, fallbackPool, safeLimit);
  };

  if (!db) {
    return fallbackSource ? buildFallback(fallbackSource) : [];
  }

  try {
    const sourceRows = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const sourceCourse = sourceRows[0] || fallbackSource;
    if (!sourceCourse) return [];

    const sameCategoryRows = await db
      .select()
      .from(courses)
      .where(eq(courses.category, sourceCourse.category))
      .orderBy(desc(courses.rating), desc(courses.reviewCount))
      .limit(250);

    const mergedPool = [...sameCategoryRows];
    const categoryFallbackRows = FALLBACK_COURSES.filter(
      (course) => course.category.toLowerCase() === sourceCourse.category.toLowerCase()
    );

    for (const fallbackCourse of categoryFallbackRows) {
      if (!mergedPool.some((course) => course.id === fallbackCourse.id)) {
        mergedPool.push(fallbackCourse);
      }
    }

    return buildSameCategoryComparisonRows(sourceCourse, mergedPool, safeLimit);
  } catch (error) {
    console.error("[Database] getSameCategoryCourseComparison failed, using fallback data:", error);
    return fallbackSource ? buildFallback(fallbackSource) : [];
  }
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
  if (!db) return getFallbackRecommendations(userId, limit);

  try {
    const recs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, userId))
      .orderBy(desc(recommendations.rank))
      .limit(limit);

    if (recs.length === 0) {
      return getFallbackRecommendations(userId, limit);
    }

    // Fetch course details for each recommendation
    const courseIds = recs.map(r => r.courseId);
    const courseDetails = await db
      .select()
      .from(courses)
      .where(inArray(courses.id, courseIds));

    const courseMap = new Map(courseDetails.map(c => [c.id, c]));
    const hydratedRecs = recs.map(rec => ({
      ...rec,
      course: courseMap.get(rec.courseId),
    }));

    // If recommendations exist but no course rows can be resolved, use fallback.
    if (!hydratedRecs.some((rec) => rec.course)) {
      return getFallbackRecommendations(userId, limit);
    }

    return hydratedRecs;
  } catch (error) {
    console.error("[Database] getUserRecommendations failed, using fallback data:", error);
    return getFallbackRecommendations(userId, limit);
  }
}

export async function saveRecommendations(recs: Array<{
  userId: number;
  courseId: number;
  score: number;
  reason: string;
  algorithm: "content-based" | "collaborative" | "hybrid" | "popularity" | "learning-pattern";
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
  if (!db) {
    if (canUseInMemoryAuthFallback()) {
      return getInMemoryUserByEmail(email);
    }
    return undefined;
  }

  try {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] getUserByEmail failed:", error);
    if (canUseInMemoryAuthFallback()) {
      return getInMemoryUserByEmail(email);
    }
    return undefined;
  }
}

export async function createUser(data: { email: string; name: string; passwordHash: string }) {
  const db = getDb();
  const openId = `email-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (!db) {
    if (canUseInMemoryAuthFallback()) {
      return upsertInMemoryUser({
        openId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        loginMethod: "email",
        role: "user",
        lastSignedIn: new Date(),
      });
    }

    throw new Error("Database not available");
  }

  try {
    await db.insert(users).values({
      openId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      loginMethod: "email",
      role: "user",
      lastSignedIn: new Date(),
    });
    return getUserByOpenId(openId);
  } catch (error) {
    console.error("[Database] createUser failed:", error);
    if (canUseInMemoryAuthFallback()) {
      return upsertInMemoryUser({
        openId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        loginMethod: "email",
        role: "user",
        lastSignedIn: new Date(),
      });
    }
    throw error;
  }
}

// ── Bookmark Functions ───────────────────────────────────────────────
export async function getUserBookmarks(userId: number) {
  const db = getDb();
  if (!db) {
    if (canUseInMemoryBookmarkFallback()) {
      return getInMemoryUserBookmarks(userId);
    }
    return [];
  }

  try {
    const bmarks = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
    const courseIds = bmarks.map((bookmark) => bookmark.courseId);
    if (courseIds.length === 0) return [];

    const courseDetails = await db.select().from(courses).where(inArray(courses.id, courseIds));
    const courseMap = new Map(courseDetails.map((course) => [course.id, course]));
    return bmarks.map((bookmark) => ({ ...bookmark, course: courseMap.get(bookmark.courseId) }));
  } catch (error) {
    console.error("[Database] getUserBookmarks failed:", error);
    if (canUseInMemoryBookmarkFallback()) {
      return getInMemoryUserBookmarks(userId);
    }
    return [];
  }
}

export async function addBookmark(userId: number, courseId: number, notes?: string) {
  const db = getDb();
  if (!db) {
    if (canUseInMemoryBookmarkFallback()) {
      return addInMemoryBookmark(userId, courseId, notes);
    }
    return;
  }

  try {
    // Check if already bookmarked
    const existing = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.courseId, courseId)))
      .limit(1);

    if (existing.length > 0) return existing[0];

    await db.insert(bookmarks).values({ userId, courseId, notes: notes || null });
    return { userId, courseId, notes };
  } catch (error) {
    console.error("[Database] addBookmark failed:", error);
    if (canUseInMemoryBookmarkFallback()) {
      return addInMemoryBookmark(userId, courseId, notes);
    }
    return;
  }
}

export async function removeBookmark(userId: number, courseId: number) {
  const db = getDb();
  if (!db) {
    if (canUseInMemoryBookmarkFallback()) {
      removeInMemoryBookmark(userId, courseId);
    }
    return;
  }

  try {
    await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.courseId, courseId)));
  } catch (error) {
    console.error("[Database] removeBookmark failed:", error);
    if (canUseInMemoryBookmarkFallback()) {
      removeInMemoryBookmark(userId, courseId);
    }
  }
}

// ── Platform Rating Functions ────────────────────────────────────────
export async function getPlatformRatingsForCourse(courseId: number) {
  const db = getDb();
  const fallbackCourse = FALLBACK_COURSES.find((course) => course.id === courseId);

  if (!db) {
    return fallbackCourse ? buildFallbackPlatformRatings(fallbackCourse) : [];
  }

  try {
    const result = await db
      .select()
      .from(platformRatings)
      .where(eq(platformRatings.courseId, courseId));

    if (result.length > 0) return result;

    const courseResult = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const sourceCourse = courseResult.length > 0 ? courseResult[0] : fallbackCourse;
    if (!sourceCourse) return [];

    return buildFallbackPlatformRatings(sourceCourse);
  } catch (error) {
    console.error("[Database] getPlatformRatingsForCourse failed, using fallback data:", error);
    return fallbackCourse ? buildFallbackPlatformRatings(fallbackCourse) : [];
  }
}

export async function getTopRatedCourses(limit = 20) {
  const db = getDb();
  const fallback = sortCoursesByRating(FALLBACK_COURSES).slice(0, limit);
  if (!db) return fallback;
  try {
    const result = await db.select().from(courses).orderBy(desc(courses.rating)).limit(limit);
    if (result.length > 0) return result;
    return fallback;
  } catch (error) {
    console.error("[Database] getTopRatedCourses failed, using fallback data:", error);
    return fallback;
  }
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
