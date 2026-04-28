"""Endpoints de administración: gestión de usuarios e invitaciones."""
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import AdminUser
from app.models.auth import Role, User, UserInvitation
from app.schemas.auth import (
    InvitationCreate,
    InvitationRead,
    ResetLinkResponse,
    RoleRead,
    UserRead,
    UserUpdateAdmin,
)
from app.services.auth_service import generate_one_shot_token

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(AdminUser)])


# ── Roles (catálogo, lectura) ────────────────────────────────────────

@router.get("/roles", response_model=list[RoleRead])
def list_roles(db: Annotated[Session, Depends(get_db)]):
    return db.execute(select(Role).order_by(Role.role_id)).scalars().all()


# ── Usuarios ─────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserRead])
def list_users(db: Annotated[Session, Depends(get_db)]):
    return db.execute(select(User).order_by(User.user_id)).scalars().all()


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdateAdmin,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None and payload.email != user.email:
        existing = db.execute(
            select(User).where(User.email == payload.email, User.user_id != user_id)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Email ya en uso")
        user.email = payload.email
    if payload.role_id is not None:
        if not db.get(Role, payload.role_id):
            raise HTTPException(status_code=400, detail="Rol no existe")
        user.role_id = payload.role_id

    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/deactivate", response_model=UserRead)
def toggle_user_active(
    user_id: int,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="No puedes desactivarte a ti mismo")
    user.active = not user.active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}


# ── Reset de password (admin genera enlace) ──────────────────────────

@router.post("/users/{user_id}/reset-password", response_model=ResetLinkResponse)
def generate_reset_link(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.reset_token = generate_one_shot_token()
    user.reset_token_expires_at = datetime.utcnow() + timedelta(hours=24)
    db.commit()
    return ResetLinkResponse(
        reset_token=user.reset_token,
        expires_at=user.reset_token_expires_at,
    )


# ── Invitaciones ─────────────────────────────────────────────────────

@router.post("/invitations", response_model=InvitationRead, status_code=201)
def create_invitation(
    payload: InvitationCreate,
    admin: AdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    if not db.get(Role, payload.role_id):
        raise HTTPException(status_code=400, detail="Rol no existe")

    existing_user = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")

    invitation = UserInvitation(
        email=payload.email,
        full_name=payload.full_name,
        role_id=payload.role_id,
        token=generate_one_shot_token(),
        expires_at=datetime.utcnow() + timedelta(days=7),
        created_by=admin.user_id,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


@router.get("/invitations", response_model=list[InvitationRead])
def list_invitations(db: Annotated[Session, Depends(get_db)]):
    return db.execute(
        select(UserInvitation).order_by(UserInvitation.created_at.desc())
    ).scalars().all()


@router.delete("/invitations/{invitation_id}")
def cancel_invitation(
    invitation_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    inv = db.get(UserInvitation, invitation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.used_at:
        raise HTTPException(status_code=400, detail="La invitación ya fue usada")
    inv.is_cancelled = True
    db.commit()
    return {"cancelled": invitation_id}
