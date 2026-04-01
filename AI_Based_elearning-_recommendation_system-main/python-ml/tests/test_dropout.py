from ml.dropout_predictor import DropoutPredictor
import numpy as np

def test_dropout_untrained():
    predictor = DropoutPredictor()
    risk = predictor.predict_risk(np.array([[1, 2, 3]]))
    assert risk == 0.5
