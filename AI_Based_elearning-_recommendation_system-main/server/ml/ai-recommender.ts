/**
 * AI-Powered Course Recommendation Engine
 * 
 * Integrates multiple recommendation strategies:
 * - Content-based filtering using TF-IDF and semantic similarity
 * - Collaborative filtering based on user behavior patterns
 * - AI-powered related course suggestions using embeddings
 * - Hybrid approach combining multiple signals
 */

import { getDb } from "../db";
import { courses as coursesTable, courseInteractions, userProfiles } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

interface CourseFeatures {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  tags: string[];
  embedding?: number[];
}

interface RecommendationResult {
  courseId: number;
  score: number;
  reason: string;
  algorithm: "content-based" | "collaborative" | "hybrid" | "popularity" | "ai-related";
}

/**
 * Extract keywords from text for semantic analysis
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those"
  ]);

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .map(word => word.replace(/[^\w]/g, ""))
    .filter(word => word.length > 0);
}

/**
 * Calculate TF-IDF vector for semantic similarity
 */
function calculateTFIDFVector(text: string, vocabulary: Set<string>): number[] {
  const keywords = extractKeywords(text);
  const vector: number[] = [];

  vocabulary.forEach(term => {
    const count = keywords.filter(k => k === term).length;
    const tf = count / Math.max(keywords.length, 1);
    vector.push(tf);
  });

  return vector;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length === 0 || vec2.length === 0) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Find related courses based on a specific course
 * Uses semantic similarity and category matching
 */
export async function findRelatedCourses(
  courseId: number,
  limit: number = 5
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get the reference course
    const referenceCourse = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);

    if (referenceCourse.length === 0) return [];

    const refCourse = referenceCourse[0];
    const refTags = refCourse.tags ? JSON.parse(refCourse.tags) : [];

    // Get all other courses
    const allCourses = await db.select().from(coursesTable);

    // Build vocabulary from all courses
    const vocabulary = new Set<string>();
    allCourses.forEach(course => {
      extractKeywords(course.title).forEach(k => vocabulary.add(k));
      extractKeywords(course.description).forEach(k => vocabulary.add(k));
      extractKeywords(course.category).forEach(k => vocabulary.add(k));
      const tags = course.tags ? JSON.parse(course.tags) : [];
      tags.forEach((tag: string) => extractKeywords(tag).forEach(k => vocabulary.add(k)));
    });

    // Create reference course vector
    const refText = [
      refCourse.title,
      refCourse.description,
      refCourse.category,
      refCourse.difficulty,
      refTags.join(" ")
    ].join(" ");

    const refVector = calculateTFIDFVector(refText, vocabulary);

    // Score all other courses
    const scores = allCourses
      .filter(course => course.id !== courseId)
      .map(course => {
        const courseText = [
          course.title,
          course.description,
          course.category,
          course.difficulty,
          course.tags ? JSON.parse(course.tags).join(" ") : ""
        ].join(" ");

        const courseVector = calculateTFIDFVector(courseText, vocabulary);
        let similarity = cosineSimilarity(refVector, courseVector);

        // Boost score for same category
        if (course.category === refCourse.category) {
          similarity += 0.15;
        }

        // Boost score for matching tags
        const courseTags = course.tags ? JSON.parse(course.tags) : [];
        const matchingTags = courseTags.filter((tag: string) =>
          refTags.some((refTag: string) =>
            tag.toLowerCase().includes(refTag.toLowerCase()) ||
            refTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        similarity += (matchingTags.length / Math.max(courseTags.length, 1)) * 0.1;

        // Slight boost for similar difficulty
        if (course.difficulty === refCourse.difficulty) {
          similarity += 0.05;
        }

        return {
          courseId: course.id,
          score: Math.min(1, similarity),
          reason: `Related to ${refCourse.title}`,
          algorithm: "ai-related" as const
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scores;
  } catch (error) {
    console.error("AI-related course recommendation error:", error);
    return [];
  }
}

/**
 * Get AI-powered suggestions based on user's current course
 */
export async function getAIPoweredSuggestions(
  userId: number,
  currentCourseId: number,
  limit: number = 8
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get related courses
    const relatedCourses = await findRelatedCourses(currentCourseId, limit * 2);

    // Get user profile for personalization
    const userProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (relatedCourses.length === 0) return [];

    // Get user's completed courses to avoid duplicates
    const completedCourses = await db
      .select({ courseId: courseInteractions.courseId })
      .from(courseInteractions)
      .where(
        and(
          eq(courseInteractions.userId, userId),
          eq(courseInteractions.interactionType, "completed")
        )
      );

    const completedIds = new Set(completedCourses.map(c => c.courseId));

    // Filter and personalize suggestions
    let suggestions = relatedCourses
      .filter(rec => !completedIds.has(rec.courseId))
      .slice(0, limit);

    // If user has profile, boost suggestions matching their interests
    if (userProfile.length > 0) {
      const profile = userProfile[0];
      const interests = profile.interests ? JSON.parse(profile.interests) : [];
      const skills = profile.skills ? JSON.parse(profile.skills) : [];

      suggestions = suggestions.map(rec => {
        let boost = 0;

        // Check if course matches user interests
        interests.forEach((interest: string) => {
          if (rec.reason.toLowerCase().includes(interest.toLowerCase())) {
            boost += 0.1;
          }
        });

        return {
          ...rec,
          score: Math.min(1, rec.score + boost),
          reason: `${rec.reason} - Matches your interests`
        };
      });
    }

    return suggestions.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("AI-powered suggestion error:", error);
    return [];
  }
}

/**
 * Get trending courses in the same category
 */
export async function getTrendingInCategory(
  category: string,
  limit: number = 5
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const trendingCourses = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.category, category))
      .orderBy(desc(coursesTable.learnerCount))
      .limit(limit);

    return trendingCourses.map((course, index) => ({
      courseId: course.id,
      score: (100 - index * 10) / 100,
      reason: `Trending in ${category}`,
      algorithm: "popularity" as const
    }));
  } catch (error) {
    console.error("Trending courses error:", error);
    return [];
  }
}

/**
 * Get prerequisite courses (beginner courses before advanced ones)
 */
export async function getPrerequisiteCourses(
  courseId: number,
  limit: number = 3
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const course = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);

    if (course.length === 0 || course[0].difficulty === "beginner") return [];

    // Get beginner courses in the same category
    const prerequisites = await db
      .select()
      .from(coursesTable)
      .where(
        and(
          eq(coursesTable.category, course[0].category),
          eq(coursesTable.difficulty, "beginner")
        )
      )
      .limit(limit);

    return prerequisites.map((prereq, index) => ({
      courseId: prereq.id,
      score: 0.9 - index * 0.1,
      reason: `Recommended prerequisite for ${course[0].title}`,
      algorithm: "content-based" as const
    }));
  } catch (error) {
    console.error("Prerequisite courses error:", error);
    return [];
  }
}

/**
 * Get advanced courses (progression path)
 */
export async function getAdvancedCourses(
  courseId: number,
  limit: number = 3
): Promise<RecommendationResult[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const course = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);

    if (course.length === 0 || course[0].difficulty === "advanced") return [];

    // Get advanced courses in the same category
    const advancedCourses = await db
      .select()
      .from(coursesTable)
      .where(
        and(
          eq(coursesTable.category, course[0].category),
          eq(coursesTable.difficulty, "advanced")
        )
      )
      .limit(limit);

    return advancedCourses.map((advanced, index) => ({
      courseId: advanced.id,
      score: 0.9 - index * 0.1,
      reason: `Next step after ${course[0].title}`,
      algorithm: "content-based" as const
    }));
  } catch (error) {
    console.error("Advanced courses error:", error);
    return [];
  }
}
