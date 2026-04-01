const ML_SERVICE_URL = process.env.PYTHON_ML_URL ?? "http://localhost:8000";

export type MlAlgorithm = "content-based" | "collaborative" | "hybrid" | "popularity";

export type MlRecommendation = {
  courseId: number;
  score: number;
  reason: string;
  algorithm: MlAlgorithm;
};

type RawMlRecommendation = {
  course_id: number;
  score: number;
  reason: string;
  algorithm: string;
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
