from fastapi import APIRouter
from schemas import RecommendationRequest, RecommendationResponse, CourseRef
from db import get_db_connection
from ml.cold_start import get_popular_courses
from ml.scorer import calculate_content_score
from typing import Optional


ALLOWED_ALGORITHMS = {"content-based", "collaborative", "hybrid", "popularity"}

WEIGHTS = {
    "content_based": {"content": 0.7, "difficulty": 0.3},
    "collaborative": {"collaborative": 0.65, "popularity": 0.35},
    "hybrid": {
        "content": 0.35,
        "collaborative": 0.2,
        "popularity": 0.2,
        "rating": 0.15,
        "difficulty": 0.1,
    },
}


def _difficulty_match_score(preferred: Optional[str], current: Optional[str]) -> float:
    if not preferred or not current:
        return 0.5
    if preferred == current:
        return 1.0
    order = {"beginner": 1, "intermediate": 2, "advanced": 3}
    pref_rank = order.get(preferred, 2)
    current_rank = order.get(current, 2)
    diff = abs(pref_rank - current_rank)
    if diff == 1:
        return 0.6
    return 0.25


def _normalize(value: float, max_value: float) -> float:
    if max_value <= 0:
        return 0.0
    return max(0.0, min(1.0, value / max_value))


def _top_signal_name(content: float, collaborative: float, popularity: float, difficulty: float) -> str:
    signals = [
        ("your interests", content),
        ("similar learner activity", collaborative),
        ("current popularity", popularity),
        ("difficulty fit", difficulty),
    ]
    signals.sort(key=lambda item: item[1], reverse=True)
    return signals[0][0]


def _reason_content_based(category: str, content_score: float, difficulty_score: float) -> str:
    signal = _top_signal_name(content_score, 0.0, 0.0, difficulty_score)
    return f"Strong {signal} match in {category}"


def _reason_collaborative(collaborative_score: float, popularity_score: float) -> str:
    signal = _top_signal_name(0.0, collaborative_score, popularity_score, 0.0)
    return f"Suggested from {signal}"


def _reason_hybrid(category: str, content_score: float, collaborative_score: float, popularity_score: float, difficulty_score: float) -> str:
    signal = _top_signal_name(content_score, collaborative_score, popularity_score, difficulty_score)
    return f"Balanced recommendation from {signal} in {category}"

router = APIRouter(tags=["recommendations"])

@router.post("/recommend", response_model=RecommendationResponse)
def get_recommendations(req: RecommendationRequest):
    limit = max(1, min(req.limit, 50))
    requested_algorithm = (req.algorithm or "hybrid").strip().lower()
    algorithm = requested_algorithm if requested_algorithm in ALLOWED_ALGORITHMS else "hybrid"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT skills, interests, preferredDifficulty FROM userProfiles WHERE userId = ? LIMIT 1",
            (req.user_id,),
        )
        profile_row = cursor.fetchone()
        user_profile = dict(profile_row) if profile_row else {}

        cursor.execute(
            "SELECT courseId, interactionType FROM courseInteractions WHERE userId = ?",
            (req.user_id,),
        )
        user_interactions = [dict(row) for row in cursor.fetchall()]
        interacted_course_ids = {row["courseId"] for row in user_interactions}

        if len(user_interactions) < 3 or algorithm == "popularity":
            popular_courses = get_popular_courses(conn, limit * 3)
            recommendations = []
            for index, course in enumerate(popular_courses):
                if course["id"] in interacted_course_ids:
                    continue
                popularity_score = max(0.05, 1.0 - (index * 0.04))
                recommendations.append(
                    CourseRef(
                        course_id=course["id"],
                        score=round(popularity_score, 4),
                        reason=f"Popular with {course.get('learnerCount', 0)} learners in {course.get('category', 'learning')}",
                        algorithm="popularity",
                    )
                )
                if len(recommendations) >= limit:
                    break
            return RecommendationResponse(recommendations=recommendations)

        cursor.execute("SELECT * FROM courses")
        all_courses = [dict(row) for row in cursor.fetchall()]
        if not all_courses:
            return RecommendationResponse(recommendations=[])

        cursor.execute(
            "SELECT courseId, COUNT(*) as interactionCount FROM courseInteractions GROUP BY courseId"
        )
        interaction_counts = {row["courseId"]: row["interactionCount"] for row in cursor.fetchall()}
        max_interaction_count = max(interaction_counts.values()) if interaction_counts else 1

        max_learner_count = max([course.get("learnerCount", 0) or 0 for course in all_courses] + [1])

        preferred_difficulty = user_profile.get("preferredDifficulty")

        scored_courses = []
        for course in all_courses:
            if course["id"] in interacted_course_ids:
                continue

            content_score = calculate_content_score(user_profile, course)
            content_score = min(1.0, content_score)
            collaborative_score = _normalize(
                float(interaction_counts.get(course["id"], 0)),
                float(max_interaction_count),
            )
            popularity_score = _normalize(
                float(course.get("learnerCount", 0) or 0),
                float(max_learner_count),
            )
            rating_score = _normalize(float(course.get("rating", 0) or 0), 500.0)
            difficulty_score = _difficulty_match_score(preferred_difficulty, course.get("difficulty"))

            if algorithm == "content-based":
                w = WEIGHTS["content_based"]
                final_score = w["content"] * content_score + w["difficulty"] * difficulty_score
                reason = _reason_content_based(
                    course.get("category", "learning"), content_score, difficulty_score
                )
            elif algorithm == "collaborative":
                w = WEIGHTS["collaborative"]
                final_score = (
                    w["collaborative"] * collaborative_score
                    + w["popularity"] * popularity_score
                )
                reason = _reason_collaborative(collaborative_score, popularity_score)
            else:
                w = WEIGHTS["hybrid"]
                final_score = (
                    w["content"] * content_score
                    + w["collaborative"] * collaborative_score
                    + w["popularity"] * popularity_score
                    + w["rating"] * rating_score
                    + w["difficulty"] * difficulty_score
                )
                reason = _reason_hybrid(
                    course.get("category", "learning"),
                    content_score,
                    collaborative_score,
                    popularity_score,
                    difficulty_score,
                )

            scored_courses.append(
                CourseRef(
                    course_id=course["id"],
                    score=round(max(0.0, min(1.0, final_score)), 4),
                    reason=reason,
                    algorithm=algorithm,
                )
            )

        scored_courses.sort(key=lambda rec: rec.score, reverse=True)
        return RecommendationResponse(recommendations=scored_courses[:limit])
