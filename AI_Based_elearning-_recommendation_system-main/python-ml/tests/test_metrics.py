from evaluate_recommendations import (
    average_precision_at_k,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
)


def test_precision_recall_at_k():
    recommended = [10, 11, 12, 13]
    relevant = {11, 13, 15}

    assert precision_at_k(recommended, relevant, 4) == 0.5
    assert round(recall_at_k(recommended, relevant, 4), 4) == 0.6667


def test_ndcg_and_map_at_k():
    recommended = [5, 7, 11, 13]
    relevant = {7, 13}

    ndcg = ndcg_at_k(recommended, relevant, 4)
    mean_ap = average_precision_at_k(recommended, relevant, 4)

    assert 0.0 <= ndcg <= 1.0
    assert round(mean_ap, 4) == 0.5
