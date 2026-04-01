from fastapi import APIRouter
from schemas import ABTestClickRequest

router = APIRouter(prefix="/ab_test", tags=["ab_testing"])

@router.post("/click")
def record_click(req: ABTestClickRequest):
    return {"status": "recorded"}

@router.get("/summary")
def get_summary():
    return {"metrics": {}}
