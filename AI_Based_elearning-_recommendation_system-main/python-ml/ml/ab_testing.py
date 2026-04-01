import hashlib

def assign_bucket(user_id: int, experiment_name: str) -> str:
    hash_input = f"{user_id}_{experiment_name}".encode('utf-8')
    hash_val = int(hashlib.md5(hash_input).hexdigest(), 16)
    
    if hash_val % 2 == 0:
        return "control"
    else:
        return "variant"
