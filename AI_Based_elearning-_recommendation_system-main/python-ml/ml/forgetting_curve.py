import math
import time

def calculate_retention(memory_strength: float, last_reviewed_timestamp: int) -> float:
    # Ebbinghaus forgetting curve: R = e^(-t/S)
    now = int(time.time())
    days_elapsed = max(0, (now - last_reviewed_timestamp) / 86400.0)
    
    if memory_strength <= 0:
        return 0.0
        
    return math.exp(-days_elapsed / memory_strength)
