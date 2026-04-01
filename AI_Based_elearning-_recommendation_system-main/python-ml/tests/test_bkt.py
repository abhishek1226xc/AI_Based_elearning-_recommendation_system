from ml.knowledge_tracing import BKTModel

def test_bkt_update_correct():
    model = BKTModel(p_init=0.5)
    new_p = model.update(correct=True)
    assert new_p > 0.5

def test_bkt_update_incorrect():
    model = BKTModel(p_init=0.5)
    new_p = model.update(correct=False)
    assert new_p < 0.5
