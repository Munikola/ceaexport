"""Endpoints públicos: aceptar invitación, resetear password."""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.auth import User, UserInvitation
from app.schemas.auth import (
    AcceptInvitationRequest,
    InvitationPublicRead,
    ResetPasswordRequest,
    ResetTokenInfo,
    TokenResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    hash_password,
)

router = APIRouter(prefix="/public", tags=["public"])


# ── Invitaciones ─────────────────────────────────────────────────────

def _load_valid_invitation(token: str, db: Session) -> UserInvitation:
    inv = db.execute(
        select(UserInvitation).where(UserInvitation.token == token)
    ).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.is_cancelled:
        raise HTTPException(status_code=400, detail="Invitación cancelada")
    if inv.used_at:
        raise HTTPException(status_code=400, detail="Invitación ya usada")
    if inv.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invitación expirada")
    return inv


@router.get("/invitations/{token}", response_model=InvitationPublicRead)
def view_invitation(token: str, db: Annotated[Session, Depends(get_db)]):
    inv = _load_valid_invitation(token, db)
    return InvitationPublicRead(
        email=inv.email,
        full_name=inv.full_name,
        role_name=inv.role.role_name,
    )


@router.post("/invitations/{token}/accept", response_model=TokenResponse)
def accept_invitation(
    token: str,
    payload: AcceptInvitationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    inv = _load_valid_invitation(token, db)

    # Comprobar que el email no se haya creado en otro flujo mientras tanto
    existing = db.execute(select(User).where(User.email == inv.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")

    user = User(
        full_name=payload.full_name,
        email=inv.email,
        password_hash=hash_password(payload.password),
        role_id=inv.role_id,
        active=True,
    )
    db.add(user)
    db.flush()  # para obtener user_id

    inv.used_at = datetime.utcnow()
    inv.used_by = user.user_id
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.user_id, user.role_code),
        refresh_token=create_refresh_token(user.user_id),
    )


# ── Reset de password ────────────────────────────────────────────────

def _load_user_by_reset_token(token: str, db: Session) -> User:
    user = db.execute(
        select(User).where(User.reset_token == token)
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Enlace de reset no válido")
    if not user.reset_token_expires_at or user.reset_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Enlace de reset expirado")
    return user


@router.get("/reset/{token}", response_model=ResetTokenInfo)
def view_reset(token: str, db: Annotated[Session, Depends(get_db)]):
    user = _load_user_by_reset_token(token, db)
    return ResetTokenInfo(full_name=user.full_name)


@router.post("/reset/{token}")
def apply_reset(
    token: str,
    payload: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
):
    user = _load_user_by_reset_token(token, db)
    user.password_hash = hash_password(payload.password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    return {"status": "ok"}
