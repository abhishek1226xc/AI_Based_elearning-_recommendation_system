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

class StudyPatternRequest(BaseModel):
    user_id: int
    lookback_days: int = 30

# Responses
class CourseRef(BaseModel):
    course_id: int
    score: float
    reason: str
    algorithm: str

class RecommendationResponse(BaseModel):
    recommendations: List[CourseRef]

class StudyPatternResponse(BaseModel):
    user_id: int
    lookback_days: int
    total_interactions: int
    active_days: int
    consistency_score: float
    avg_session_minutes: float
    completion_rate: float
    dominant_study_window: str
    top_category: Optional[str] = None
    signals: List[str]
