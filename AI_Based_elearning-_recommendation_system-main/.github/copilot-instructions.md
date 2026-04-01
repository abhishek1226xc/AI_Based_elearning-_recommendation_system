# Copilot context
## TypeScript side
Stack: TypeScript, Express, tRPC v11, Drizzle ORM,
SQLite (better-sqlite3), React 19, Vite 7, Tailwind 4, pnpm,
Vercel AI SDK.
DB: SQLite at data/elearning.db. Schema in shared/.
API: all routes are tRPC. No REST endpoints in TypeScript.
Auth: JWT via jose. Cookie sessions.
## Python side
Stack: Python 3.11, FastAPI, SQLite3 (stdlib), NumPy,
scikit-learn, sentence-transformers, pandas, uvicorn.
Entry: python-ml/main.py  Port: 8000
DB: reads same SQLite file at ../data/elearning.db (read-only).
## Communication
TypeScript -> Python: HTTP POST to PYTHON_ML_URL env var.
All ML endpoints are in python-ml/routers/.
## UI
client/ is frozen. No changes to any file inside client/.
