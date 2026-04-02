from datetime import datetime, timedelta
from collections import Counter
from fastapi import APIRouter

from db import get_db_connection
from schemas import StudyPatternRequest, StudyPatternResponse

router = APIRouter(tags=["study-pattern"])


def _study_window_from_hour(hour: int) -> str:
    if 5 <= hour <= 11:
        return "morning"
    if 12 <= hour <= 16:
        return "afternoon"
    if 17 <= hour <= 21:
        return "evening"
    return "night"


def _safe_div(numerator: float, denominator: float) -> float:
    if denominator <= 0:
        return 0.0
    return numerator / denominator


@router.post("/study-pattern", response_model=StudyPatternResponse)
def get_study_pattern(req: StudyPatternRequest):
    lookback_days = max(7, min(req.lookback_days, 180))
    cutoff = int((datetime.utcnow() - timedelta(days=lookback_days)).timestamp())

    with get_db_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT ci.interactionType, ci.timeSpent, ci.completionPercentage, ci.timestamp, c.category
            FROM courseInteractions ci
            LEFT JOIN courses c ON c.id = ci.courseId
            WHERE ci.userId = ? AND ci.timestamp >= ?
            ORDER BY ci.timestamp ASC
            """,
            (req.user_id, cutoff),
        )
        rows = [dict(row) for row in cursor.fetchall()]

    if not rows:
        return StudyPatternResponse(
            user_id=req.user_id,
            lookback_days=lookback_days,
            total_interactions=0,
            active_days=0,
            consistency_score=0.0,
            avg_session_minutes=0.0,
            completion_rate=0.0,
            dominant_study_window="unknown",
            top_category=None,
            signals=["No recent activity found; start with one study session to build your pattern."],
        )

    active_dates = {
        datetime.utcfromtimestamp(int(row["timestamp"]))
        .date()
        .isoformat()
        for row in rows
        if row.get("timestamp") is not None
    }

    windows = Counter()
    categories = Counter()
    session_minutes = []
    started = 0
    completed = 0

    for row in rows:
        ts = row.get("timestamp")
        if ts is not None:
            hour = datetime.utcfromtimestamp(int(ts)).hour
            windows[_study_window_from_hour(hour)] += 1

        if row.get("category"):
            categories[row["category"]] += 1

        time_spent = row.get("timeSpent")
        if isinstance(time_spent, (int, float)) and time_spent > 0:
            session_minutes.append(float(time_spent) / 60.0)

        interaction_type = row.get("interactionType")
        completion = row.get("completionPercentage") or 0
        if interaction_type == "started":
            started += 1
        if interaction_type == "completed" or (isinstance(completion, (int, float)) and completion >= 100):
            completed += 1

    active_days = len(active_dates)
    consistency_score = round(_safe_div(active_days, lookback_days) * 100.0, 2)
    avg_session_minutes = round(_safe_div(sum(session_minutes), len(session_minutes)), 2)
    completion_rate = round(_safe_div(completed, max(started, 1)) * 100.0, 2)

    dominant_window = windows.most_common(1)[0][0] if windows else "unknown"
    top_category = categories.most_common(1)[0][0] if categories else None

    signals = []
    if consistency_score >= 55:
        signals.append("Consistency is strong; maintain current weekly rhythm.")
    elif consistency_score >= 25:
        signals.append("Consistency is moderate; adding one extra study day can improve retention.")
    else:
        signals.append("Consistency is low; start with short sessions across 3 fixed days each week.")

    if avg_session_minutes >= 45:
        signals.append("Session length indicates deep-focus study behavior.")
    elif avg_session_minutes > 0:
        signals.append("Session length is short; consider 30-45 minute focused blocks.")

    if completion_rate >= 70:
        signals.append("Course completion behavior is strong.")
    else:
        signals.append("Completion trend is low; prioritize finishing one active course first.")

    if top_category:
        signals.append(f"Highest engagement category: {top_category}.")

    signals.append(f"Preferred study window: {dominant_window}.")

    return StudyPatternResponse(
        user_id=req.user_id,
        lookback_days=lookback_days,
        total_interactions=len(rows),
        active_days=active_days,
        consistency_score=consistency_score,
        avg_session_minutes=avg_session_minutes,
        completion_rate=completion_rate,
        dominant_study_window=dominant_window,
        top_category=top_category,
        signals=signals,
    )
