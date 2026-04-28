"""Modelos ORM para autenticación, mapeados al schema existente en `db/schema.sql`.

NO se redefinen aquí las tablas — solo se mapean a las columnas existentes.
La creación de tablas vive en `db/schema.sql` y `db/migrations/01_auth_extensions.sql`.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    role_name: Mapped[str] = mapped_column(String(100), nullable=False)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("roles.role_id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Reset password (añadido en 01_auth_extensions.sql)
    reset_token: Mapped[str | None] = mapped_column(String(100), unique=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime)

    role: Mapped[Role | None] = relationship(lazy="joined")

    @property
    def role_code(self) -> str | None:
        return self.role.role_code if self.role else None


class UserInvitation(Base):
    __tablename__ = "user_invitations"

    invitation_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(150))
    role_id: Mapped[int] = mapped_column(Integer, ForeignKey("roles.role_id"), nullable=False)
    token: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)
    used_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)

    role: Mapped[Role] = relationship(lazy="joined", foreign_keys=[role_id])
