def get_popular_courses(db_conn, limit: int = 10):
    cursor = db_conn.cursor()
    cursor.execute("SELECT * FROM courses ORDER BY learnerCount DESC LIMIT ?", (limit,))
    return [dict(row) for row in cursor.fetchall()]
