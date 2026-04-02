const ML_SERVICE_URL = process.env.PYTHON_ML_URL ?? "http://localhost:8000";

export type MlAlgorithm = "content-based" | "collaborative" | "hybrid" | "popularity";

export type MlRecommendation = {
  courseId: number;
  score: number;
  reason: string;
  algorithm: MlAlgorithm;
};

export type StudyPatternInsights = {
  userId: number;
  lookbackDays: number;
  totalInteractions: number;
  activeDays: number;
  consistencyScore: number;
  avgSessionMinutes: number;
  completionRate: number;
  dominantStudyWindow: string;
  topCategory: string | null;
  signals: string[];
};

type RawMlRecommendation = {
  course_id: number;
  score: number;
  reason: string;
  algorithm: string;
};

type RawStudyPatternInsights = {
  user_id: number;
  lookback_days: number;
  total_interactions: number;
  active_days: number;
  consistency_score: number;
  avg_session_minutes: number;
  completion_rate: number;
  dominant_study_window: string;
  top_category: string | null;
  signals: string[];
};

const toMlAlgorithm = (algorithm: string): MlAlgorithm => {
  if (algorithm === "content-based") return "content-based";
  if (algorithm === "collaborative") return "collaborative";
  if (algorithm === "popularity") return "popularity";
  return "hybrid";
};

const normalizeRecommendation = (raw: RawMlRecommendation): MlRecommendation => ({
  courseId: raw.course_id,
  score: raw.score,
  reason: raw.reason,
  algorithm: toMlAlgorithm(raw.algorithm),
});

const normalizeStudyPattern = (raw: RawStudyPatternInsights): StudyPatternInsights => ({
  userId: raw.user_id,
  lookbackDays: raw.lookback_days,
  totalInteractions: raw.total_interactions,
  activeDays: raw.active_days,
  consistencyScore: raw.consistency_score,
  avgSessionMinutes: raw.avg_session_minutes,
  completionRate: raw.completion_rate,
  dominantStudyWindow: raw.dominant_study_window,
  topCategory: raw.top_category,
  signals: raw.signals,
});

export async function checkMlHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/health`);
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function getRecommendations(
  userId: number,
  limit = 10,
  algorithm?: MlAlgorithm
): Promise<{ recommendations: MlRecommendation[] }> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, limit, algorithm }),
    });
    if (!res.ok) throw new Error("ML service error");
    const payload = (await res.json()) as {
      recommendations?: RawMlRecommendation[];
    };
    const normalized = (payload.recommendations ?? []).map(normalizeRecommendation);
    return { recommendations: normalized };
  } catch (error) {
    console.error("Failed to get ML recommendations:", error);
    return { recommendations: [] };
  }
}

export async function sendFeedback(
  userId: number,
  courseId: number,
  feedbackType: string
): Promise<void> {
  await fetch(`${ML_SERVICE_URL}/ab_test/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      recommendation_id: courseId,
      clicked: true,
      feedback_type: feedbackType,
    }),
  });
}

export async function getStudyPatternInsights(
  userId: number,
  lookbackDays = 30
): Promise<StudyPatternInsights | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/study-pattern`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, lookback_days: lookbackDays }),
    });
    if (!res.ok) throw new Error("ML study-pattern endpoint error");

    const payload = (await res.json()) as RawStudyPatternInsights;
    return normalizeStudyPattern(payload);
  } catch (error) {
    console.error("Failed to fetch study-pattern insights:", error);
    return null;
  }
}
