"""Servicio de autenticación: hashing, JWT, validaciones."""
import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, status

from app.core.config import get_settings

_settings = get_settings()
_hasher = PasswordHasher()


# ── Validación de fortaleza de password ──────────────────────────────

def validate_password_strength(password: str) -> str | None:
    """Devuelve mensaje de error si no cumple, None si está OK."""
    if len(password) < 8:
        return "La contraseña debe tener al menos 8 caracteres"
    if not re.search(r"[A-Z]", password):
        return "La contraseña debe tener al menos 1 mayúscula"
    if not re.search(r"[a-z]", password):
        return "La contraseña debe tener al menos 1 minúscula"
    if len(re.findall(r"[0-9]", password)) < 2:
        return "La contraseña debe tener al menos 2 números"
    if not re.search(r"[^A-Za-z0-9]", password):
        return "La contraseña debe tener al menos 1 carácter especial"
    return None


# ── Hashing con Argon2 ────────────────────────────────────────────────

def hash_password(password: str) -> str:
    error = validate_password_strength(password)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────

def create_access_token(user_id: int, role_code: str | None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role_code,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=_settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, _settings.jwt_secret_key, algorithm=_settings.jwt_algorithm)


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=_settings.refresh_token_expire_days),
    }
    return jwt.encode(payload, _settings.jwt_secret_key, algorithm=_settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _settings.jwt_secret_key, algorithms=[_settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ── Tokens de un solo uso (invitaciones, reset) ───────────────────────

def generate_one_shot_token() -> str:
    """URL-safe, ~43 caracteres, criptográficamente fuerte."""
    return secrets.token_urlsafe(32)
