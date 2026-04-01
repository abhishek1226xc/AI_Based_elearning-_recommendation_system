from ml.forgetting_curve import calculate_retention
import time

def test_calculate_retention_recent():
    now = int(time.time())
    retention = calculate_retention(memory_strength=5.0, last_reviewed_timestamp=now)
    assert retention == 1.0

def test_calculate_retention_past():
    now = int(time.time())
    # 5 days ago
    past = now - (5 * 86400)
    retention = calculate_retention(memory_strength=5.0, last_reviewed_timestamp=past)
    assert 0.0 < retention < 1.0
