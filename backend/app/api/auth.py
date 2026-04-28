"""Endpoints de autenticación: login, refresh, perfil propio."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import CurrentUser
from app.models.auth import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserRead,
    UserUpdateMe,
)
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if not user or not user.password_hash or not user.active:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    return TokenResponse(
        access_token=create_access_token(user.user_id, user.role_code),
        refresh_token=create_refresh_token(user.user_id),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshRequest,
    db: Annotated[Session, Depends(get_db)],
):
    decoded = decode_token(payload.refresh_token)
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")

    try:
        user_id = int(decoded["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido") from None

    user = db.execute(select(User).where(User.user_id == user_id)).scalar_one_or_none()
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")

    return TokenResponse(
        access_token=create_access_token(user.user_id, user.role_code),
        refresh_token=create_refresh_token(user.user_id),
    )


@router.get("/me", response_model=UserRead)
def me(current: CurrentUser):
    return current


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: UserUpdateMe,
    current: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    if payload.full_name is not None:
        current.full_name = payload.full_name

    if payload.email is not None and payload.email != current.email:
        existing = db.execute(
            select(User).where(User.email == payload.email, User.user_id != current.user_id)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Email ya en uso")
        current.email = payload.email

    if payload.password is not None:
        current.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(current)
    return current
