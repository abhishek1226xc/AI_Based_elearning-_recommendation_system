from fastapi import APIRouter
from ml import dropout_predictor

router = APIRouter(prefix="/train", tags=["training"])

@router.post("/")
def trigger_training():
    dropout_predictor.train_dropout_model()
    return {"status": "trained"}
