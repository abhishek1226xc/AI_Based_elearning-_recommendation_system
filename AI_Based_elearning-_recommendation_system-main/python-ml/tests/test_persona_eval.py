from persona_evaluation import top_courses_for_persona


def test_top_courses_for_persona_orders_scores_descending():
    persona = {
        "skills": "python",
        "interests": "data",
        "preferredDifficulty": "beginner",
    }
    courses = [
        {
            "id": 1,
            "title": "Course A",
            "category": "Data",
            "difficulty": "beginner",
            "tags": '["python", "data"]',
            "learnerCount": 1000,
            "rating": 450,
        },
        {
            "id": 2,
            "title": "Course B",
            "category": "Web",
            "difficulty": "advanced",
            "tags": '["react"]',
            "learnerCount": 50,
            "rating": 300,
        },
    ]

    ranked = top_courses_for_persona(persona, courses, limit=2)

    assert len(ranked) == 2
    assert ranked[0][0] == 1
    assert ranked[0][2] >= ranked[1][2]
