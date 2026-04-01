from fastapi import APIRouter
from schemas import RecommendationRequest, RecommendationResponse, CourseRef
from db import get_db_connection
from ml.cold_start import get_popular_courses
from ml.scorer import calculate_content_score
from typing import Optional


ALLOWED_ALGORITHMS = {"content-based", "collaborative", "hybrid", "popularity"}


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
                        reason=f"Popular with {course.get('learnerCount', 0)} learners",
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
                final_score = 0.7 * content_score + 0.3 * difficulty_score
                reason = f"Matches your interests in {course.get('category', 'learning')}"
            elif algorithm == "collaborative":
                final_score = 0.65 * collaborative_score + 0.35 * popularity_score
                reason = "Users with similar activity explored this course"
            else:
                final_score = (
                    0.35 * content_score
                    + 0.2 * collaborative_score
                    + 0.2 * popularity_score
                    + 0.15 * rating_score
                    + 0.1 * difficulty_score
                )
                reason = f"Balanced match for your profile and current trends"

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
