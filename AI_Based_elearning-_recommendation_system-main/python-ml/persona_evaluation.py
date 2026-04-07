import argparse
import json
from typing import Dict, Iterable, List, Tuple

from db import get_db_connection
from ml.scorer import calculate_content_score

PERSONAS = {
    "new_learner": {
        "skills": "",
        "interests": "python,data",
        "preferredDifficulty": "beginner",
    },
    "struggling_learner": {
        "skills": "basics",
        "interests": "guided,foundations",
        "preferredDifficulty": "beginner",
    },
    "fast_learner": {
        "skills": "python,sql,ml",
        "interests": "advanced,optimization,projects",
        "preferredDifficulty": "advanced",
    },
    "inconsistent_learner": {
        "skills": "python",
        "interests": "web,data",
        "preferredDifficulty": "intermediate",
    },
}

WEIGHTS = {
    "content": 0.45,
    "popularity": 0.25,
    "rating": 0.2,
    "difficulty": 0.1,
}


def _difficulty_match_score(preferred: str, current: str) -> float:
    if not preferred or not current:
        return 0.5
    if preferred == current:
        return 1.0

    order = {"beginner": 1, "intermediate": 2, "advanced": 3}
    diff = abs(order.get(preferred, 2) - order.get(current, 2))
    if diff == 1:
        return 0.6
    return 0.25


def _normalize(value: float, max_value: float) -> float:
    if max_value <= 0:
        return 0.0
    return max(0.0, min(1.0, value / max_value))


def _score_course(persona: Dict[str, str], course: Dict[str, object], max_learner_count: float) -> float:
    content_score = min(1.0, calculate_content_score(persona, course))
    popularity_score = _normalize(float(course.get("learnerCount", 0) or 0), max_learner_count)
    rating_score = _normalize(float(course.get("rating", 0) or 0), 500.0)
    difficulty_score = _difficulty_match_score(
        str(persona.get("preferredDifficulty", "intermediate")),
        str(course.get("difficulty", "intermediate")),
    )

    return (
        WEIGHTS["content"] * content_score
        + WEIGHTS["popularity"] * popularity_score
        + WEIGHTS["rating"] * rating_score
        + WEIGHTS["difficulty"] * difficulty_score
    )


def top_courses_for_persona(persona: Dict[str, str], courses: Iterable[Dict[str, object]], limit: int) -> List[Tuple[int, str, float]]:
    course_list = list(courses)
    if not course_list:
        return []

    max_learner_count = max([float(c.get("learnerCount", 0) or 0) for c in course_list] + [1.0])

    scored: List[Tuple[int, str, float]] = []
    for course in course_list:
        score = _score_course(persona, course, max_learner_count)
        scored.append((int(course["id"]), str(course["title"]), round(score, 4)))

    scored.sort(key=lambda item: item[2], reverse=True)
    return scored[:limit]


def _load_courses() -> List[Dict[str, object]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, category, difficulty, tags, learnerCount, rating FROM courses")
        rows = cursor.fetchall()

    courses: List[Dict[str, object]] = []
    for row in rows:
        courses.append(
            {
                "id": row["id"],
                "title": row["title"],
                "category": row["category"],
                "difficulty": row["difficulty"],
                "tags": row["tags"] if row["tags"] else json.dumps([]),
                "learnerCount": row["learnerCount"],
                "rating": row["rating"],
            }
        )
    return courses


def run_persona_evaluation(limit: int) -> None:
    courses = _load_courses()
    if not courses:
        print("No courses found. Seed data first.")
        return

    print("=== Persona Scenario Evaluation ===")
    for persona_name, profile in PERSONAS.items():
        print(f"\n[{persona_name}]")
        for rank, (course_id, title, score) in enumerate(top_courses_for_persona(profile, courses, limit), start=1):
            print(f"{rank}. course_id={course_id} score={score:.4f} title={title}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Persona-based recommendation scenario evaluation")
    parser.add_argument("--limit", type=int, default=5, help="Number of top courses per persona")
    args = parser.parse_args()

    run_persona_evaluation(max(1, args.limit))


if __name__ == "__main__":
    main()
