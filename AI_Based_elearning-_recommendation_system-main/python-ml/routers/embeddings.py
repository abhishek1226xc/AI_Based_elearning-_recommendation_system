from fastapi import APIRouter
from schemas import SimilarCoursesRequest

router = APIRouter(prefix="/embeddings", tags=["embeddings"])

@router.post("/similar")
def find_similar_courses(req: SimilarCoursesRequest):
    return {"similar_courses": []}
