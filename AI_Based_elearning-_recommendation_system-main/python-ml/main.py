import os
import uvicorn
from fastapi import FastAPI
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from routers import health, recommend, train, embeddings, ab_test, study_pattern

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up Python ML Microservice...")
    yield
    print("Shutting down Python ML Microservice...")

app = FastAPI(
    title="E-Learning AI Recommendation Service",
    description="Standalone Python microservice for AI algorithms",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(health.router)
app.include_router(recommend.router)
app.include_router(train.router)
app.include_router(embeddings.router)
app.include_router(ab_test.router)
app.include_router(study_pattern.router)

if __name__ == "__main__":
    port = int(os.getenv("ML_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
