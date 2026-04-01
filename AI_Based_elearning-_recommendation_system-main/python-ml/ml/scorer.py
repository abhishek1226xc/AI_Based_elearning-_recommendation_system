from typing import List, Dict, Any

def calculate_content_score(user_profile: Dict[str, Any], course: Dict[str, Any]) -> float:
    # A simple scoring based on tags matching
    score = 0.0
    user_skills = set(str(user_profile.get("skills", "")).split(","))
    course_tags_raw = course.get("tags", "[]")

    import json
    try:
        course_tags = set(json.loads(course_tags_raw))
    except:
        course_tags = set()
    
    if user_skills and course_tags:
        intersection = user_skills.intersection(course_tags)
        score += len(intersection) * 0.5
        
    return score
