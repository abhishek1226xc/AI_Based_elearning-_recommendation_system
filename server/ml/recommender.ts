/**
 * Course Recommendation Engine
 * 
 * Provides multiple recommendation algorithms:
 * 1. Content-based filtering (profile interests vs course metadata)
 * 2. Collaborative filtering (cosine similarity on user interactions)
 * 3. Popularity-based recommendations
 * 4. Hybrid approach combining all signals
 */

import { getDb } from "../db";
import { courses as coursesTable, courseInteractions, userProfiles } from "../../drizzle/schema";
import { eq, desc, and, ne } from "drizzle-orm";

interface RecommendationResult {
  courseId: number;
  score: number;
  reason: string;
  algorithm: "content-based" | "collaborative" | "hybrid" | "popularity";
}

/**
 * Cosine similarity between two numeric vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0) return 0;
  const dot = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB + 1e-9);
}

/**
 * Content-based recommendations: match user profile interests/skills to
 * course category, tags, and difficulty.
 */
export async function contentBasedRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get user profile
    const profile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    // Get all courses
    const allCourses = await db.select().from(coursesTable);
    if (allCourses.length === 0) return [];

    // Get courses the user has already interacted with
    const interactions = await db
      .select({ courseId: courseInteractions.courseId })
      .from(courseInteractions)
      .where(eq(courseInteractions.userId, userId));

    const interactedIds = new Set(interactions.map((i) => i.courseId));

    // Parse user interests and skills
    const interests: string[] = profile.length > 0 && profile[0].interests
      ? JSON.parse(profile[0].interests)
      : [];
    const skills: string[] = profile.length > 0 && profile[0].skills
      ? JSON.parse(profile[0].skills)
      : [];
    const preferredDifficulty = profile.length > 0
      ? profile[0].preferredDifficulty
      : "intermediate";

    const userKeywords = [...interests, ...skills].map((k) => k.toLowerCase());

    // Score each course
    const scored = allCourses
      .filter((c) => !interactedIds.has(c.id))
      .map((course) => {
        let score = 0;

        // Category match
        if (userKeywords.some((k) => course.category.toLowerCase().includes(k))) {
          score += 0.4;
        }

        // Tag match
        const tags: string[] = course.tags ? JSON.parse(course.tags) : [];
        const matchingTags = tags.filter((t) =>
          userKeywords.some((k) => t.toLowerCase().includes(k))
        );
        score += (matchingTags.length / Math.max(tags.length, 1)) * 0.3;

        // Difficulty match
        if (course.difficulty === preferredDifficulty) {
          score += 0.2;
        }

        // Rating boost
        score += ((course.rating ?? 0) / 500) * 0.1;

        return {
          courseId: course.id,
          score: Math.min(1, score),
          reason: `Matches your interests in ${course.category}`,
          algorithm: "content-based" as const,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  } catch (error) {
    console.error("Content-based recommendation error:", error);
    return [];
  }
}

/**
 * Collaborative filtering: find similar users by interaction patterns
 * and recommend what they liked.
 */
export async function collaborativeRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get all interactions
    const allInteractions = await db.select().from(courseInteractions);
    if (allInteractions.length === 0) return [];

    // Build user–course matrix
    const userIds = Array.from(new Set(allInteractions.map((i) => i.userId)));
    const courseIds = Array.from(new Set(allInteractions.map((i) => i.courseId)));

    // Create sparse interaction vectors per user
    const userVectors: Record<number, number[]> = {};
    for (const uid of userIds) {
      userVectors[uid] = courseIds.map((cid) => {
        const interaction = allInteractions.find(
          (i) => i.userId === uid && i.courseId === cid
        );
        if (!interaction) return 0;
        // Weight by interaction type
        const weights: Record<string, number> = {
          viewed: 1, started: 2, completed: 4, rated: 3, bookmarked: 2,
        };
        return weights[interaction.interactionType] ?? 1;
      });
    }

    const targetVector = userVectors[userId];
    if (!targetVector) return [];

    // Find most similar users
    const similarities = userIds
      .filter((uid) => uid !== userId)
      .map((uid) => ({
        userId: uid,
        similarity: cosineSimilarity(targetVector, userVectors[uid]),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    // Courses the target user has NOT interacted with
    const targetCourseIds = new Set(
      allInteractions.filter((i) => i.userId === userId).map((i) => i.courseId)
    );

    // Aggregate recommendations from similar users
    const courseScores: Record<number, { score: number; count: number }> = {};
    for (const sim of similarities) {
      const theirInteractions = allInteractions.filter(
        (i) => i.userId === sim.userId && !targetCourseIds.has(i.courseId)
      );
      for (const interaction of theirInteractions) {
        if (!courseScores[interaction.courseId]) {
          courseScores[interaction.courseId] = { score: 0, count: 0 };
        }
        courseScores[interaction.courseId].score += sim.similarity;
        courseScores[interaction.courseId].count += 1;
      }
    }

    return Object.entries(courseScores)
      .map(([cid, { score, count }]) => ({
        courseId: Number(cid),
        score: Math.min(1, score / Math.max(count, 1)),
        reason: "Users with similar interests enjoyed this course",
        algorithm: "collaborative" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("Collaborative recommendation error:", error);
    return [];
  }
}

/**
 * Popularity-based recommendations: highest enrollment + rating,
 * excluding courses the user has already interacted with.
 */
export async function popularityRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const interactions = await db
      .select({ courseId: courseInteractions.courseId })
      .from(courseInteractions)
      .where(eq(courseInteractions.userId, userId));

    const interactedIds = new Set(interactions.map((i) => i.courseId));

    const popular = await db
      .select()
      .from(coursesTable)
      .orderBy(desc(coursesTable.learnerCount))
      .limit(limit + interactedIds.size);

    return popular
      .filter((c) => !interactedIds.has(c.id))
      .slice(0, limit)
      .map((course, index) => ({
        courseId: course.id,
        score: (100 - index * 5) / 100,
        reason: `Popular course with ${course.learnerCount ?? 0} learners`,
        algorithm: "popularity" as const,
      }));
  } catch (error) {
    console.error("Popularity recommendation error:", error);
    return [];
  }
}

/**
 * Hybrid recommendations: combine content-based, collaborative,
 * and popularity signals with configurable weights.
 */
export async function hybridRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  try {
    const [content, collab, popular] = await Promise.all([
      contentBasedRecommendations(userId, limit * 2),
      collaborativeRecommendations(userId, limit * 2),
      popularityRecommendations(userId, limit * 2),
    ]);

    // Merge scores with weights
    const scoreMap: Record<number, { score: number; reasons: string[] }> = {};

    const addScores = (
      recs: RecommendationResult[],
      weight: number
    ) => {
      for (const rec of recs) {
        if (!scoreMap[rec.courseId]) {
          scoreMap[rec.courseId] = { score: 0, reasons: [] };
        }
        scoreMap[rec.courseId].score += rec.score * weight;
        scoreMap[rec.courseId].reasons.push(rec.reason);
      }
    };

    addScores(content, 0.4);
    addScores(collab, 0.35);
    addScores(popular, 0.25);

    return Object.entries(scoreMap)
      .map(([cid, { score, reasons }]) => ({
        courseId: Number(cid),
        score: Math.min(1, score),
        reason: reasons[0] ?? "Recommended for you",
        algorithm: "hybrid" as const,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("Hybrid recommendation error:", error);
    return [];
  }
}
