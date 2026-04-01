from ml.scorer import calculate_content_score

def test_calculate_content_score():
    user = {"skills": "python,react"}
    course = {"tags": '["python", "data"]'}
    score = calculate_content_score(user, course)
    assert score == 0.5
