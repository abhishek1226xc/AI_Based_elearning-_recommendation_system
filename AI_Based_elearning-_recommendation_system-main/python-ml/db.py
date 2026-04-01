import sqlite3
import os
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "data",
    "elearning.db",
)
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH)

@contextmanager
def get_db_connection():
    db_abs_path = os.path.abspath(DB_PATH)
    conn = sqlite3.connect(db_abs_path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
