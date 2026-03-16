/**
 * Course Recommendation Engine
 *
 * Provides multiple recommendation algorithms:
 * 1. Content-based filtering (profile + behavior + metadata)
 * 2. Collaborative filtering (similar learners + interaction strength)
 * 3. Learning-pattern recommendations (pace + completion + difficulty path)
 * 4. Popularity-based recommendations (quality-adjusted popularity)
 * 5. Hybrid reranking (quality, diversity, and free-course coverage)
 */

import { getDb } from "../db";
import {
  courses as coursesTable,
  courseInteractions,
  userProfiles,
  type Course,
} from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

interface RecommendationResult {
  courseId: number;
  score: number;
  reason: string;
  algorithm: "content-based" | "collaborative" | "hybrid" | "popularity" | "learning-pattern";
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those",
]);

const INTERACTION_WEIGHTS: Record<string, number> = {
  viewed: 1,
  started: 2,
  bookmarked: 2,
  rated: 3,
  completed: 4,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
    }
  } catch {
    // Fall through to CSV style parsing.
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function buildKeywordSet(values: string[]): Set<string> {
  return new Set(values.flatMap((value) => tokenize(value)));
}

function keywordOverlap(tokens: string[], keywords: Set<string>): number {
  if (tokens.length === 0 || keywords.size === 0) return 0;

  let matches = 0;
  for (const token of tokens) {
    if (keywords.has(token)) matches += 1;
  }

  return clamp01(matches / tokens.length);
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

function ratingScore(course: Course): number {
  return clamp01((course.rating || 0) / 500);
}

function reviewScore(course: Course): number {
  return clamp01(Math.log10((course.reviewCount || 0) + 1) / 5);
}

function learnerScore(course: Course): number {
  return clamp01(Math.log10((course.learnerCount || 0) + 1) / 6);
}

function completionScore(course: Course): number {
  return clamp01((course.completionRate || 0) / 100);
}

function courseQualityScore(course: Course): number {
  return clamp01(
    ratingScore(course) * 0.45 +
      reviewScore(course) * 0.2 +
      learnerScore(course) * 0.2 +
      completionScore(course) * 0.15
  );
}

function normalizeInteractionRating(rating: number | null | undefined): number {
  if (rating === null || rating === undefined) return 0;
  if (rating <= 5) return clamp01(rating / 5);
  return clamp01(rating / 500);
}

function difficultyLevel(difficulty: string | null | undefined): number {
  if (difficulty === "beginner") return 0;
  if (difficulty === "advanced") return 2;
  return 1;
}

function difficultyAlignment(preferredLevel: number, courseDifficulty: string | null | undefined): number {
  const delta = Math.abs(preferredLevel - difficultyLevel(courseDifficulty));
  return clamp01(1 - delta / 2);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Content-based recommendations: match user profile interests/skills/goals
 * plus historical behavior to category, tags, and description.
 */
export async function contentBasedRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const [profileRows, allCourses, interactions] = await Promise.all([
      db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
      db.select().from(coursesTable),
      db
        .select({
          courseId: courseInteractions.courseId,
          interactionType: courseInteractions.interactionType,
        })
        .from(courseInteractions)
        .where(eq(courseInteractions.userId, userId)),
    ]);

    if (allCourses.length === 0) return [];

    const profile = profileRows[0];
    const preferredDifficulty = profile?.preferredDifficulty || "intermediate";
    const interactedIds = new Set(interactions.map((interaction) => interaction.courseId));
    const courseMap = new Map(allCourses.map((course) => [course.id, course]));

    const interests = parseJsonArray(profile?.interests);
    const skills = parseJsonArray(profile?.skills);
    const learningGoals = parseJsonArray(profile?.learningGoals);

    const historyKeywords: string[] = [];
    for (const interaction of interactions) {
      const strength = INTERACTION_WEIGHTS[interaction.interactionType] ?? 1;
      if (strength < 2) continue;

      const course = courseMap.get(interaction.courseId);
      if (!course) continue;

      historyKeywords.push(course.category);
      historyKeywords.push(...parseJsonArray(course.tags));
    }

    const keywordSet = buildKeywordSet([...interests, ...skills, ...learningGoals, ...historyKeywords]);

    const candidates = allCourses.filter((course) => !interactedIds.has(course.id));
    if (candidates.length === 0) return [];

    const scored = candidates
      .map((course) => {
        const tags = parseJsonArray(course.tags);

        const categoryTokens = tokenize(course.category);
        const tagTokens = tags.flatMap((tag) => tokenize(tag));
        const textTokens = tokenize(`${course.title} ${course.description}`);

        const categoryMatch = keywordOverlap(categoryTokens, keywordSet);
        const tagMatch = keywordOverlap(tagTokens, keywordSet);
        const textMatch = keywordOverlap(textTokens, keywordSet);
        const difficultyMatch = course.difficulty === preferredDifficulty ? 1 : 0;

        const quality = courseQualityScore(course);
        const freeBoost = isFreeCourse(course) ? 0.08 : 0;

        const personalizedScore =
          categoryMatch * 0.32 +
          tagMatch * 0.34 +
          textMatch * 0.2 +
          difficultyMatch * 0.08 +
          quality * 0.26 +
          freeBoost;

        const coldStartScore = quality * 0.55 + learnerScore(course) * 0.35 + freeBoost;

        const score = keywordSet.size > 0 ? personalizedScore : coldStartScore;

        const matchingTags = tags
          .filter((tag) => tokenize(tag).some((token) => keywordSet.has(token)))
          .slice(0, 2);

        let reason = "Recommended for your learning goals";
        if (matchingTags.length > 0) {
          reason = `Strong match: ${matchingTags.join(", ")}`;
        } else if (categoryMatch > 0.5) {
          reason = `Good fit for your ${course.category} goals`;
        } else if (isFreeCourse(course)) {
          reason = `High-quality free course on ${course.platform}`;
        } else {
          reason = `High-quality ${course.category} course for your level`;
        }

        return {
          courseId: course.id,
          score: clamp01(score),
          reason,
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
 * Collaborative filtering: find similar users from weighted interaction vectors
 * and recommend courses they engaged with strongly.
 */
export async function collaborativeRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const [allInteractions, allCourses] = await Promise.all([
      db
        .select({
          userId: courseInteractions.userId,
          courseId: courseInteractions.courseId,
          interactionType: courseInteractions.interactionType,
          rating: courseInteractions.rating,
          completionPercentage: courseInteractions.completionPercentage,
        })
        .from(courseInteractions),
      db.select().from(coursesTable),
    ]);

    if (allInteractions.length === 0 || allCourses.length === 0) return [];

    const courseById = new Map(allCourses.map((course) => [course.id, course]));

    const userCourseScores = new Map<number, Map<number, number>>();
    for (const interaction of allInteractions) {
      let courseScores = userCourseScores.get(interaction.userId);
      if (!courseScores) {
        courseScores = new Map<number, number>();
        userCourseScores.set(interaction.userId, courseScores);
      }

      const interactionWeight = INTERACTION_WEIGHTS[interaction.interactionType] ?? 1;
      const ratingContribution = interaction.rating ? Math.min(1.5, interaction.rating / 300) : 0;
      const completionContribution = interaction.completionPercentage
        ? Math.min(1, interaction.completionPercentage / 100)
        : 0;

      const scoreIncrement = interactionWeight + ratingContribution + completionContribution;
      const existing = courseScores.get(interaction.courseId) || 0;
      courseScores.set(interaction.courseId, Math.min(10, existing + scoreIncrement));
    }

    const targetScores = userCourseScores.get(userId);
    if (!targetScores || targetScores.size === 0) return [];

    const courseIds = Array.from(new Set(allInteractions.map((interaction) => interaction.courseId)));
    const targetVector = courseIds.map((courseId) => targetScores.get(courseId) || 0);

    const similarities = Array.from(userCourseScores.entries())
      .filter(([otherUserId]) => otherUserId !== userId)
      .map(([otherUserId, scoreMap]) => {
        const otherVector = courseIds.map((courseId) => scoreMap.get(courseId) || 0);
        return {
          userId: otherUserId,
          similarity: cosineSimilarity(targetVector, otherVector),
          scoreMap,
        };
      })
      .filter((item) => item.similarity > 0.02)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 15);

    if (similarities.length === 0) return [];

    const targetSeen = new Set(Array.from(targetScores.keys()));
    const rawScores = new Map<number, number>();
    const supporterCount = new Map<number, number>();

    for (const { similarity, scoreMap } of similarities) {
      for (const [courseId, score] of Array.from(scoreMap.entries())) {
        if (targetSeen.has(courseId)) continue;

        const currentScore = rawScores.get(courseId) || 0;
        rawScores.set(courseId, currentScore + similarity * score);

        const currentSupport = supporterCount.get(courseId) || 0;
        supporterCount.set(courseId, currentSupport + 1);
      }
    }

    if (rawScores.size === 0) return [];

    const maxRawScore = Math.max(...Array.from(rawScores.values()));

    const recommendations = Array.from(rawScores.entries())
      .map(([courseId, rawScore]) => {
        const course = courseById.get(courseId);
        const quality = course ? courseQualityScore(course) : 0.5;
        const freeBoost = course && isFreeCourse(course) ? 0.05 : 0;

        const collabScore = maxRawScore > 0 ? rawScore / maxRawScore : 0;
        const finalScore = clamp01(collabScore * 0.72 + quality * 0.23 + freeBoost);

        const support = supporterCount.get(courseId) || 1;
        let reason = "Users with similar learning patterns liked this course";

        if (course) {
          if (isFreeCourse(course)) {
            reason = `${support} similar learner${support > 1 ? "s" : ""} engaged with this free course on ${course.platform}`;
          } else {
            reason = `${support} similar learner${support > 1 ? "s" : ""} engaged with this ${course.category} course`;
          }
        }

        return {
          courseId,
          score: finalScore,
          reason,
          algorithm: "collaborative" as const,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return recommendations;
  } catch (error) {
    console.error("Collaborative recommendation error:", error);
    return [];
  }
}

/**
 * Learning-pattern recommendations:
 * use category affinity, preferred difficulty path, pace signals, and completion trends.
 */
export async function learningPatternRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const [allCourses, profileRows, interactions] = await Promise.all([
      db.select().from(coursesTable),
      db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1),
      db
        .select({
          courseId: courseInteractions.courseId,
          interactionType: courseInteractions.interactionType,
          rating: courseInteractions.rating,
          timeSpent: courseInteractions.timeSpent,
          completionPercentage: courseInteractions.completionPercentage,
        })
        .from(courseInteractions)
        .where(eq(courseInteractions.userId, userId)),
    ]);

    if (allCourses.length === 0) return [];

    const interactedCourseIds = new Set(interactions.map((interaction) => interaction.courseId));
    const courseById = new Map(allCourses.map((course) => [course.id, course]));

    const categoryStrength = new Map<string, number>();
    const difficultyStrength = new Map<string, number>();

    let completionSum = 0;
    let completionCount = 0;
    let timeSpentSum = 0;
    let timeSpentCount = 0;

    for (const interaction of interactions) {
      const course = courseById.get(interaction.courseId);
      if (!course) continue;

      const baseSignal = INTERACTION_WEIGHTS[interaction.interactionType] ?? 1;
      const ratingSignal = normalizeInteractionRating(interaction.rating);
      const completionSignal = clamp01((interaction.completionPercentage || 0) / 100);
      const timeSignal = interaction.timeSpent
        ? clamp01(Math.log10(interaction.timeSpent + 1) / 3)
        : 0;

      const engagementSignal =
        baseSignal * 0.45 +
        ratingSignal * 1.35 +
        completionSignal * 1.8 +
        timeSignal * 0.9;

      categoryStrength.set(
        course.category,
        (categoryStrength.get(course.category) || 0) + engagementSignal
      );
      difficultyStrength.set(
        course.difficulty,
        (difficultyStrength.get(course.difficulty) || 0) + engagementSignal
      );

      if (interaction.completionPercentage !== null && interaction.completionPercentage !== undefined) {
        completionSum += completionSignal;
        completionCount += 1;
      }

      if (interaction.timeSpent !== null && interaction.timeSpent !== undefined && interaction.timeSpent > 0) {
        timeSpentSum += interaction.timeSpent;
        timeSpentCount += 1;
      }
    }

    const preferredDifficultyFromBehavior = Array.from(difficultyStrength.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const preferredDifficultyFromProfile = profileRows[0]?.preferredDifficulty || "intermediate";
    const preferredDifficulty = preferredDifficultyFromBehavior || preferredDifficultyFromProfile;
    const preferredDifficultyLevel = difficultyLevel(preferredDifficulty);

    const maxCategoryStrength = categoryStrength.size > 0
      ? Math.max(...Array.from(categoryStrength.values()))
      : 1;
    const maxDifficultyStrength = difficultyStrength.size > 0
      ? Math.max(...Array.from(difficultyStrength.values()))
      : 1;

    const completionTrend = completionCount > 0 ? completionSum / completionCount : 0.45;
    const avgTimeSpent = timeSpentCount > 0 ? timeSpentSum / timeSpentCount : 0;
    const hasPatternSignal = interactions.length > 0 && categoryStrength.size > 0;

    const candidates = allCourses.filter((course) => !interactedCourseIds.has(course.id));
    if (candidates.length === 0) return [];

    return candidates
      .map((course) => {
        const categoryAffinity = hasPatternSignal
          ? clamp01((categoryStrength.get(course.category) || 0) / maxCategoryStrength)
          : 0;

        const difficultyAffinity = hasPatternSignal
          ? clamp01((difficultyStrength.get(course.difficulty) || 0) / maxDifficultyStrength)
          : difficultyAlignment(preferredDifficultyLevel, course.difficulty);

        const durationAffinity = avgTimeSpent > 0 && course.duration
          ? clamp01(
            1 -
              Math.abs(Math.log1p(course.duration) - Math.log1p(avgTimeSpent * 18)) / 4
          )
          : 0.5;

        const quality = courseQualityScore(course);
        const freeBoost = isFreeCourse(course) ? 0.05 : 0;
        const nextDifficultyLevel = preferredDifficultyLevel + 1;
        const progressionBoost =
          completionTrend > 0.65 &&
          categoryAffinity > 0.3 &&
          difficultyLevel(course.difficulty) === nextDifficultyLevel
            ? 0.08
            : 0;

        const score = hasPatternSignal
          ? categoryAffinity * 0.36 +
            difficultyAffinity * 0.22 +
            durationAffinity * 0.08 +
            completionTrend * 0.1 +
            quality * 0.24 +
            progressionBoost +
            freeBoost
          : quality * 0.68 + learnerScore(course) * 0.22 + freeBoost;

        let reason = "Recommended from your learning pattern";
        if (categoryAffinity >= 0.65) {
          reason = `Matches your strongest learning pattern in ${course.category}`;
        } else if (progressionBoost > 0) {
          reason = `Next-step ${course.difficulty} course based on your completion pattern`;
        } else if (difficultyAffinity >= 0.65) {
          reason = `Fits your ${course.difficulty} learning pace`;
        } else if (isFreeCourse(course)) {
          reason = `Free course aligned with your learning behavior`;
        } else {
          reason = `Quality ${course.category} course based on your engagement history`;
        }

        return {
          courseId: course.id,
          score: clamp01(score),
          reason,
          algorithm: "learning-pattern" as const,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("Learning-pattern recommendation error:", error);
    return [];
  }
}

/**
 * Popularity recommendations with quality adjustment.
 */
export async function popularityRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const [allCourses, interactions] = await Promise.all([
      db.select().from(coursesTable),
      db
        .select({ courseId: courseInteractions.courseId })
        .from(courseInteractions)
        .where(eq(courseInteractions.userId, userId)),
    ]);

    if (allCourses.length === 0) return [];

    const interactedIds = new Set(interactions.map((interaction) => interaction.courseId));

    return allCourses
      .filter((course) => !interactedIds.has(course.id))
      .map((course) => {
        const popularity =
          learnerScore(course) * 0.5 +
          ratingScore(course) * 0.25 +
          reviewScore(course) * 0.15 +
          completionScore(course) * 0.1;

        const freeBoost = isFreeCourse(course) ? 0.08 : 0;
        const score = clamp01(popularity + freeBoost);

        const reason = isFreeCourse(course)
          ? `Popular free course on ${course.platform}`
          : `Popular ${course.category} course with ${(course.learnerCount || 0).toLocaleString()} learners`;

        return {
          courseId: course.id,
          score,
          reason,
          algorithm: "popularity" as const,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch (error) {
    console.error("Popularity recommendation error:", error);
    return [];
  }
}

/**
 * Hybrid recommendations: weighted merge + quality rerank + diversity.
 */
export async function hybridRecommendations(
  userId: number,
  limit: number = 10
): Promise<RecommendationResult[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const expandedLimit = Math.max(limit * 2, 20);

    const [content, collab, popular] = await Promise.all([
      contentBasedRecommendations(userId, expandedLimit),
      collaborativeRecommendations(userId, expandedLimit),
      popularityRecommendations(userId, expandedLimit),
    ]);

    if (content.length === 0 && collab.length === 0 && popular.length === 0) return [];

    const hasCollaborativeSignal = collab.length > 0;
    const contentWeight = hasCollaborativeSignal ? 0.4 : 0.55;
    const collaborativeWeight = hasCollaborativeSignal ? 0.35 : 0;
    const popularityWeight = hasCollaborativeSignal ? 0.25 : 0.45;

    const scoreMap = new Map<number, { score: number; reasons: string[] }>();

    const addScores = (recs: RecommendationResult[], weight: number) => {
      for (const rec of recs) {
        const existing = scoreMap.get(rec.courseId) || { score: 0, reasons: [] };
        existing.score += rec.score * weight;
        if (!existing.reasons.includes(rec.reason)) {
          existing.reasons.push(rec.reason);
        }
        scoreMap.set(rec.courseId, existing);
      }
    };

    addScores(content, contentWeight);
    addScores(collab, collaborativeWeight);
    addScores(popular, popularityWeight);

    const candidateIds = Array.from(scoreMap.keys());
    if (candidateIds.length === 0) return [];

    const candidateCourses = await db
      .select()
      .from(coursesTable)
      .where(inArray(coursesTable.id, candidateIds));

    const courseMap = new Map(candidateCourses.map((course) => [course.id, course]));

    const reranked = candidateIds
      .map((courseId) => {
        const aggregate = scoreMap.get(courseId);
        if (!aggregate) {
          return {
            courseId,
            score: 0,
            reason: "Recommended for you",
            algorithm: "hybrid" as const,
          };
        }

        const course = courseMap.get(courseId);
        const quality = course ? courseQualityScore(course) : 0.5;
        const freeBoost = course && isFreeCourse(course) ? 0.07 : 0;

        let reason = aggregate.reasons[0] || "Recommended for you";
        if (course && isFreeCourse(course) && !reason.toLowerCase().includes("free")) {
          reason = `${reason} | Free on ${course.platform}`;
        }

        return {
          courseId,
          score: clamp01(aggregate.score * 0.68 + quality * 0.25 + freeBoost),
          reason,
          algorithm: "hybrid" as const,
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected: RecommendationResult[] = [];
    const selectedIds = new Set<number>();
    const categoryCounts = new Map<string, number>();
    const minFreeCourses = Math.min(3, limit);
    let freeSelected = 0;

    const trySelect = (rec: RecommendationResult, enforceCategoryCap: boolean): boolean => {
      if (selectedIds.has(rec.courseId)) return false;

      const course = courseMap.get(rec.courseId);
      const category = course?.category || "General";
      if (enforceCategoryCap && (categoryCounts.get(category) || 0) >= 3) return false;

      selected.push(rec);
      selectedIds.add(rec.courseId);
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

      if (course && isFreeCourse(course)) freeSelected += 1;
      return true;
    };

    for (const rec of reranked) {
      const course = courseMap.get(rec.courseId);
      if (course && isFreeCourse(course) && freeSelected < minFreeCourses) {
        trySelect(rec, true);
        if (selected.length >= limit) return selected;
      }
    }

    for (const rec of reranked) {
      trySelect(rec, true);
      if (selected.length >= limit) return selected;
    }

    for (const rec of reranked) {
      trySelect(rec, false);
      if (selected.length >= limit) return selected;
    }

    return selected.slice(0, limit);
  } catch (error) {
    console.error("Hybrid recommendation error:", error);
    return [];
  }
}
