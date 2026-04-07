import argparse
import math
from typing import Dict, List, Sequence, Set, Tuple

from db import get_db_connection

RELEVANT_INTERACTIONS = {"started", "completed", "rated", "bookmarked"}


def precision_at_k(recommended: Sequence[int], relevant: Set[int], k: int) -> float:
    if k <= 0:
        return 0.0
    top_k = list(recommended[:k])
    if not top_k:
        return 0.0
    hits = sum(1 for item in top_k if item in relevant)
    return hits / float(k)


def recall_at_k(recommended: Sequence[int], relevant: Set[int], k: int) -> float:
    if not relevant:
        return 0.0
    top_k = list(recommended[:k])
    hits = sum(1 for item in top_k if item in relevant)
    return hits / float(len(relevant))


def average_precision_at_k(recommended: Sequence[int], relevant: Set[int], k: int) -> float:
    if not relevant or k <= 0:
        return 0.0

    hits = 0
    score_sum = 0.0
    for idx, item in enumerate(recommended[:k], start=1):
        if item in relevant:
            hits += 1
            score_sum += hits / float(idx)

    denom = min(len(relevant), k)
    if denom == 0:
        return 0.0
    return score_sum / float(denom)


def ndcg_at_k(recommended: Sequence[int], relevant: Set[int], k: int) -> float:
    if k <= 0:
        return 0.0

    dcg = 0.0
    for idx, item in enumerate(recommended[:k], start=1):
        rel = 1.0 if item in relevant else 0.0
        dcg += rel / math.log2(idx + 1)

    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / math.log2(i + 1) for i in range(1, ideal_hits + 1))
    if idcg == 0:
        return 0.0

    return dcg / idcg


def get_latest_recommendations_per_user(k: int) -> Dict[int, List[int]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT r.userId, r.courseId
            FROM recommendations r
            JOIN (
                SELECT userId, MAX(generatedAt) AS latestGeneratedAt
                FROM recommendations
                GROUP BY userId
            ) latest
              ON latest.userId = r.userId
             AND latest.latestGeneratedAt = r.generatedAt
            ORDER BY r.userId, r.rank ASC
            """
        )
        rows = cursor.fetchall()

    grouped: Dict[int, List[int]] = {}
    for row in rows:
        user_id = int(row["userId"])
        course_id = int(row["courseId"])
        grouped.setdefault(user_id, []).append(course_id)

    return {user_id: recs[:k] for user_id, recs in grouped.items()}


def get_relevant_courses_per_user() -> Dict[int, Set[int]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT userId, courseId, interactionType
            FROM courseInteractions
            """
        )
        rows = cursor.fetchall()

    relevant: Dict[int, Set[int]] = {}
    for row in rows:
        interaction_type = str(row["interactionType"]).strip().lower()
        if interaction_type not in RELEVANT_INTERACTIONS:
            continue
        user_id = int(row["userId"])
        course_id = int(row["courseId"])
        relevant.setdefault(user_id, set()).add(course_id)

    return relevant


def evaluate(k: int) -> Tuple[int, float, float, float, float]:
    recommendations_by_user = get_latest_recommendations_per_user(k)
    relevant_by_user = get_relevant_courses_per_user()

    common_users = sorted(set(recommendations_by_user.keys()).intersection(relevant_by_user.keys()))
    if not common_users:
        return 0, 0.0, 0.0, 0.0, 0.0

    precision_sum = 0.0
    recall_sum = 0.0
    ndcg_sum = 0.0
    map_sum = 0.0

    for user_id in common_users:
        recommended = recommendations_by_user[user_id]
        relevant = relevant_by_user[user_id]

        precision_sum += precision_at_k(recommended, relevant, k)
        recall_sum += recall_at_k(recommended, relevant, k)
        ndcg_sum += ndcg_at_k(recommended, relevant, k)
        map_sum += average_precision_at_k(recommended, relevant, k)

    n = float(len(common_users))
    return (
        len(common_users),
        precision_sum / n,
        recall_sum / n,
        ndcg_sum / n,
        map_sum / n,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline recommendation quality evaluation")
    parser.add_argument("--k", type=int, default=10, help="Cutoff for top-k metrics")
    args = parser.parse_args()

    users, precision, recall, ndcg, mean_ap = evaluate(args.k)

    print("=== Offline Recommendation Metrics ===")
    print(f"users_evaluated: {users}")
    print(f"k: {args.k}")
    print(f"precision@{args.k}: {precision:.4f}")
    print(f"recall@{args.k}: {recall:.4f}")
    print(f"ndcg@{args.k}: {ndcg:.4f}")
    print(f"map@{args.k}: {mean_ap:.4f}")


if __name__ == "__main__":
    main()
