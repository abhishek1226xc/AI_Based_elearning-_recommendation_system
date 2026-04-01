try:
    from sentence_transformers import SentenceTransformer
    # We use MiniLM as requested
    model = SentenceTransformer('all-MiniLM-L6-v2')
except ImportError:
    model = None

def get_embedding(text: str) -> list:
    if model is None:
        return []
    return model.encode(text).tolist()

def cosine_similarity(v1: list, v2: list) -> float:
    import numpy as np
    if not v1 or not v2:
        return 0.0
    vec1 = np.array(v1)
    vec2 = np.array(v2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(np.dot(vec1, vec2) / (norm1 * norm2))
