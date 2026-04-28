"""Crea el primer usuario administrador.

Uso:
    python -m scripts.bootstrap_admin --email admin@cea.com --name "Administrador" --password "..."

Si ya existen usuarios en la base, se aborta. Para crear más usuarios después,
usar el flujo de invitaciones desde el panel de admin.
"""
import argparse
import sys
from pathlib import Path

# Permite ejecutar como script independiente desde backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.models.auth import Role, User  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap del primer admin")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True, help="Nombre completo")
    parser.add_argument("--password", required=True, help="Contraseña fuerte (8+, May/min/2 num/especial)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing_count = db.execute(select(User)).scalars().all()
        if existing_count:
            print("⚠ Ya existen usuarios. El bootstrap solo se ejecuta cuando la base está vacía.")
            print("  Usar el flujo de invitaciones desde el panel de administración.")
            return 1

        admin_role = db.execute(
            select(Role).where(Role.role_code == "admin")
        ).scalar_one_or_none()
        if not admin_role:
            print("✗ No existe el rol 'admin'. ¿Cargaste seeds.sql?")
            return 1

        user = User(
            full_name=args.name,
            email=args.email,
            password_hash=hash_password(args.password),
            role_id=admin_role.role_id,
            active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✓ Admin creado: user_id={user.user_id} email={user.email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
