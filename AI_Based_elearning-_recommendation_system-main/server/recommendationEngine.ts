import { db } from "./_core/db";

type CourseRow = {
  id: number;
  title: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string | null;
  learnerCount: number | null;
  rating: number | null;
};

type UserProfileRow = {
  skills: string | null;
  interests: string | null;
  preferredDifficulty: string | null;
};

type InteractionAggregate = {
  courseId: number;
  interactionScore: number;
};

type RecommendationInsert = {
  userId: number;
  courseId: number;
  score: number;
  reason: string;
  algorithm: string;
  rank: number;
  expiresAt: number;
};

export type RecommendationRow = {
  recommendationId: number;
  rank: number;
  score: number;
  reason: string;
  algorithm: string;
  courseId: number;
  title: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string | null;
  instructor: string | null;
  duration: number | null;
  platform: string;
  platformUrl: string | null;
  platformPrice: string;
  rating: number;
  learnerCount: number;
  completionRate: number;
  thumbnailUrl: string | null;
};

const RECOMMENDATION_LIMIT = 12;
const RECOMMENDATION_TTL_SECONDS = 24 * 60 * 60;

const parseJsonStringArray = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
};

const normalizedDifficultyScore = (
  preferred: string | null,
  current: string
): number => {
  if (!preferred) return 0.5;
  if (preferred === current) return 1;

  const rankMap: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
  };

  const pref = rankMap[preferred] ?? 2;
  const cur = rankMap[current] ?? 2;
  const diff = Math.abs(pref - cur);

  if (diff === 1) return 0.6;
  return 0.25;
};

const normalize = (value: number, max: number): number => {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
};

const getUserIds = (userId?: number): number[] => {
  if (userId) return [userId];
  const rows = db.prepare("SELECT id FROM users").all() as Array<{ id: number }>;
  return rows.map((row) => row.id);
};

const getUserProfile = (userId: number): UserProfileRow | null => {
  const row = db
    .prepare(
      `SELECT skills, interests, preferredDifficulty
       FROM userProfiles
       WHERE userId = ?
       LIMIT 1`
    )
    .get(userId) as UserProfileRow | undefined;

  return row ?? null;
};

const getInteractionScores = (userId: number): Map<number, number> => {
  const rows = db
    .prepare(
      `SELECT courseId,
              SUM(CASE interactionType
                    WHEN 'completed' THEN 4
                    WHEN 'rated' THEN 3
                    WHEN 'started' THEN 2
                    WHEN 'bookmarked' THEN 2
                    ELSE 1
                  END) AS interactionScore
       FROM courseInteractions
       WHERE userId = ?
       GROUP BY courseId`
    )
    .all(userId) as InteractionAggregate[];

  return new Map(rows.map((row) => [row.courseId, row.interactionScore]));
};

const getGlobalInteractionScores = (): Map<number, number> => {
  const rows = db
    .prepare(
      `SELECT courseId,
              SUM(CASE interactionType
                    WHEN 'completed' THEN 4
                    WHEN 'rated' THEN 3
                    WHEN 'started' THEN 2
                    WHEN 'bookmarked' THEN 2
                    ELSE 1
                  END) AS interactionScore
       FROM courseInteractions
       GROUP BY courseId`
    )
    .all() as InteractionAggregate[];

  return new Map(rows.map((row) => [row.courseId, row.interactionScore]));
};

const getCourses = (): CourseRow[] => {
  return db
    .prepare(
      `SELECT id, title, category, difficulty, tags, learnerCount, rating
       FROM courses`
    )
    .all() as CourseRow[];
};

const upsertRecommendations = (recommendations: RecommendationInsert[]): void => {
  if (recommendations.length === 0) return;

  const userId = recommendations[0].userId;

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM recommendations WHERE userId = ?").run(userId);

    const insertStmt = db.prepare(
      `INSERT INTO recommendations (userId, courseId, score, reason, algorithm, rank, generatedAt, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const nowSeconds = Math.floor(Date.now() / 1000);

    for (const rec of recommendations) {
      insertStmt.run(
        rec.userId,
        rec.courseId,
        rec.score,
        rec.reason,
        rec.algorithm,
        rec.rank,
        nowSeconds,
        rec.expiresAt
      );
    }
  });

  tx();
};

const buildRecommendationsForUser = (userId: number): RecommendationInsert[] => {
  const profile = getUserProfile(userId);
  const userInteractions = getInteractionScores(userId);
  const interactedCourseIds = new Set<number>(userInteractions.keys());

  const globalInteractions = getGlobalInteractionScores();
  const courses = getCourses();

  if (courses.length === 0) return [];

  const maxLearnerCount = Math.max(...courses.map((course) => course.learnerCount ?? 0), 1);
  const maxGlobalInteraction = Math.max(
    ...Array.from(globalInteractions.values()),
    1
  );

  const interestSet = new Set([
    ...parseJsonStringArray(profile?.skills ?? null),
    ...parseJsonStringArray(profile?.interests ?? null),
  ].map((value) => value.toLowerCase()));

  const scored = courses
    .filter((course) => !interactedCourseIds.has(course.id))
    .map((course) => {
      const courseTags = parseJsonStringArray(course.tags).map((tag) => tag.toLowerCase());
      const tagMatches = courseTags.filter((tag) => interestSet.has(tag)).length;
      const tagScore = courseTags.length > 0 ? tagMatches / courseTags.length : 0;
      const categoryScore = interestSet.has(course.category.toLowerCase()) ? 1 : 0;
      const contentScore = Math.min(1, tagScore * 0.7 + categoryScore * 0.3);

      const collaborativeScore = normalize(globalInteractions.get(course.id) ?? 0, maxGlobalInteraction);
      const popularityScore = normalize(course.learnerCount ?? 0, maxLearnerCount);
      const ratingScore = normalize(course.rating ?? 0, 500);
      const difficultyScore = normalizedDifficultyScore(
        profile?.preferredDifficulty ?? null,
        course.difficulty
      );

      const hasBehaviorData = interestSet.size > 0 || userInteractions.size > 0;
      const algorithm = hasBehaviorData ? "hybrid_v1" : "cold_start_popularity";

      const finalScore = hasBehaviorData
        ? 0.35 * contentScore + 0.25 * collaborativeScore + 0.2 * popularityScore + 0.1 * ratingScore + 0.1 * difficultyScore
        : 0.65 * popularityScore + 0.35 * ratingScore;

      const reason = hasBehaviorData
        ? `Matched your interests in ${course.category}`
        : `Popular course in ${course.category}`;

      return {
        courseId: course.id,
        score: Math.round(Math.max(0, Math.min(1, finalScore)) * 100),
        reason,
        algorithm,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMENDATION_LIMIT);

  const expiresAt = Math.floor(Date.now() / 1000) + RECOMMENDATION_TTL_SECONDS;

  return scored.map((item, index) => ({
    userId,
    courseId: item.courseId,
    score: item.score,
    reason: item.reason,
    algorithm: item.algorithm,
    rank: index + 1,
    expiresAt,
  }));
};

export async function generateRecommendations(userId?: number): Promise<void> {
  const targetUserIds = getUserIds(userId);

  for (const id of targetUserIds) {
    const recommendations = buildRecommendationsForUser(id);
    upsertRecommendations(recommendations);
  }
}

export async function getRecommendationsForUser(
  userId: number
): Promise<RecommendationRow[]> {
  const rows = db
    .prepare(
      `SELECT
          r.id AS recommendationId,
          r.rank AS rank,
          r.score AS score,
          r.reason AS reason,
          r.algorithm AS algorithm,
          c.id AS courseId,
          c.title AS title,
          c.category AS category,
          c.difficulty AS difficulty,
          c.tags AS tags,
          c.instructor AS instructor,
          c.duration AS duration,
          c.platform AS platform,
          c.platformUrl AS platformUrl,
          c.platformPrice AS platformPrice,
          c.rating AS rating,
          c.learnerCount AS learnerCount,
          c.completionRate AS completionRate,
          c.thumbnailUrl AS thumbnailUrl
       FROM recommendations r
       JOIN courses c ON c.id = r.courseId
       WHERE r.userId = ?
       ORDER BY r.rank ASC`
    )
    .all(userId) as RecommendationRow[];

  return rows;
}
