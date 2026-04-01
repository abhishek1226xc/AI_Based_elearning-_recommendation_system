from sklearn.linear_model import LogisticRegression
import numpy as np

class DropoutPredictor:
    def __init__(self):
        self.model = LogisticRegression()
        self.is_trained = False
        
    def train(self, X: np.ndarray, y: np.ndarray):
        self.model.fit(X, y)
        self.is_trained = True
        
    def predict_risk(self, features: np.ndarray) -> float:
        if not self.is_trained:
            return 0.5
        return self.model.predict_proba(features.reshape(1, -1))[0][1]

def train_dropout_model():
    import json
    import os
    print("Training dropout model... (mock)")
    weights_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'weights')
    os.makedirs(weights_dir, exist_ok=True)
    with open(os.path.join(weights_dir, 'dropout.json'), 'w') as f:
        json.dump({"trained": True}, f)
    print("Saved placeholder dropout.json to weights/")
