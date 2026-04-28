"""Schemas Pydantic para autenticación."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Login y tokens ────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Usuario ───────────────────────────────────────────────────────────

class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role_id: int
    role_code: str
    role_name: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    full_name: str
    email: str | None
    active: bool
    role_id: int | None
    role: RoleRead | None
    created_at: datetime


class UserUpdateMe(BaseModel):
    """El propio usuario actualiza su perfil (no su rol)."""
    full_name: str | None = Field(None, min_length=1, max_length=150)
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=8)


class UserUpdateAdmin(BaseModel):
    """Admin actualiza datos de cualquier usuario, incluido rol."""
    full_name: str | None = Field(None, min_length=1, max_length=150)
    email: EmailStr | None = None
    role_id: int | None = None


# ── Invitaciones ──────────────────────────────────────────────────────

class InvitationCreate(BaseModel):
    email: EmailStr
    full_name: str | None = Field(None, max_length=150)
    role_id: int


class InvitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invitation_id: int
    email: str
    full_name: str | None
    role_id: int
    role: RoleRead
    token: str
    expires_at: datetime
    created_by: int | None
    created_at: datetime
    used_at: datetime | None
    is_cancelled: bool


class InvitationPublicRead(BaseModel):
    """Lo que ve quien abre el enlace (sin info sensible)."""
    email: str
    full_name: str | None
    role_name: str


class AcceptInvitationRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    password: str = Field(..., min_length=8)


# ── Reset de password ─────────────────────────────────────────────────

class ResetTokenInfo(BaseModel):
    """Lo que ve quien abre el enlace de reset."""
    full_name: str


class ResetPasswordRequest(BaseModel):
    password: str = Field(..., min_length=8)


class ResetLinkResponse(BaseModel):
    reset_token: str
    expires_at: datetime
