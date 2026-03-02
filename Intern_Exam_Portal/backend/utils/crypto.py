import os
import base64
import json
from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = os.getenv("SECRET_KEY", "internship_portal_super_secret_key_2024")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 1


def generate_candidate_token(candidate_id: int, email: str) -> tuple[str, datetime]:
    """Generate a short-lived encrypted token for a candidate test link."""
    expiry = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "candidate_id": candidate_id,
        "email": email,
        "exp": expiry,
        "type": "candidate_test"
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, expiry


def decode_candidate_token(token: str) -> dict:
    """Decode and validate a candidate test token. Raises on expiry/invalid."""
    from jose import JWTError, ExpiredSignatureError
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "candidate_test":
            raise ValueError("Invalid token type")
        return payload
    except ExpiredSignatureError:
        raise ValueError("Test link has expired")
    except JWTError:
        raise ValueError("Invalid token")
