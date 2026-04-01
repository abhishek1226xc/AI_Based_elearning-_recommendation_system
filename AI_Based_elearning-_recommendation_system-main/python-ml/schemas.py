from pydantic import BaseModel
from typing import List, Optional

# Requests
class RecommendationRequest(BaseModel):
    user_id: int
    limit: int = 10
    algorithm: Optional[str] = None

class FeedbackRequest(BaseModel):
    user_id: int
    course_id: int
    feedback_type: str # 'click', 'enroll', 'complete', 'dismiss'

class SimilarCoursesRequest(BaseModel):
    course_id: int
    limit: int = 5

class ABTestClickRequest(BaseModel):
    user_id: int
    recommendation_id: int
    clicked: bool

# Responses
class CourseRef(BaseModel):
    course_id: int
    score: float
    reason: str
    algorithm: str

class RecommendationResponse(BaseModel):
    recommendations: List[CourseRef]
