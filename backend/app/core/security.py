"""Dependencias de seguridad para los endpoints FastAPI."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.auth import User
from app.services.auth_service import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autenticado")

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Tipo de token inválido")

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido") from None

    user = db.execute(select(User).where(User.user_id == user_id)).scalar_one_or_none()
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Helpers de autorización por rol ──────────────────────────────────

def is_admin(user: User) -> bool:
    return user.role_code == "admin"


def can_manage_users(user: User) -> bool:
    return is_admin(user)


def can_validate_analyses(user: User) -> bool:
    return user.role_code in ("admin", "supervisor_calidad", "jefe_calidad")


def can_create_analyses(user: User) -> bool:
    return user.role_code in ("admin", "analista_lab", "supervisor_calidad", "jefe_calidad")


def can_create_receptions(user: User) -> bool:
    return user.role_code in ("admin", "recepcion")


def require_admin(user: CurrentUser) -> User:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    return user


AdminUser = Annotated[User, Depends(require_admin)]
