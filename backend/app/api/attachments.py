"""Endpoints para subir, listar y borrar fotos/documentos.

Almacenamiento local en `<UPLOAD_DIR>/<lot_id>/<uuid>.<ext>`.
La URL pública servida bajo `/uploads/...` (montaje estático en main.py).
"""
import shutil
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.security import CurrentUser
from app.models.attachments import Attachment, AttachmentType
from app.models.operations import Lot
from app.schemas.attachments import AttachmentRead

router = APIRouter(prefix="/attachments", tags=["attachments"])

settings = get_settings()
UPLOAD_DIR = Path(settings.upload_dir).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_BYTES = settings.upload_max_mb * 1024 * 1024


def _resolve_lot_id(db: Session, lot_id: int | None, analysis_id: int | None,
                    reception_id: int | None) -> int:
    """Asegura que tenemos un lot_id válido (la BD lo exige NOT NULL)."""
    if lot_id:
        if not db.get(Lot, lot_id):
            raise HTTPException(404, "Lote no encontrado")
        return lot_id
    if analysis_id:
        row = db.execute(
            text("SELECT lot_id FROM analysis_lots WHERE analysis_id = :a LIMIT 1"),
            {"a": analysis_id},
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(400, "Análisis sin lote asociado")
        return int(row)
    if reception_id:
        row = db.execute(
            text("SELECT lot_id FROM reception_lots WHERE reception_id = :r LIMIT 1"),
            {"r": reception_id},
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(400, "Recepción sin lote asociado")
        return int(row)
    raise HTTPException(400, "Falta lot_id, analysis_id o reception_id")


def _resolve_attachment_type(db: Session, code: str | None) -> int:
    """Devuelve attachment_type_id; default = 'foto_muestra'."""
    target = code or "foto_muestra"
    at = db.execute(
        select(AttachmentType).where(AttachmentType.type_code == target)
    ).scalar_one_or_none()
    if not at:
        # Fallback al primero disponible
        at = db.execute(select(AttachmentType).limit(1)).scalar_one_or_none()
    if not at:
        raise HTTPException(500, "No hay tipos de attachment definidos")
    return at.attachment_type_id


def _to_read(db: Session, a: Attachment) -> AttachmentRead:
    type_row = db.execute(
        text(
            "SELECT type_code, type_name FROM attachment_types "
            "WHERE attachment_type_id = :t"
        ),
        {"t": a.attachment_type_id},
    ).mappings().first()
    user_name = None
    if a.uploaded_by:
        row = db.execute(
            text("SELECT full_name FROM users WHERE user_id = :u"),
            {"u": a.uploaded_by},
        ).scalar_one_or_none()
        user_name = row
    return AttachmentRead(
        attachment_id=a.attachment_id,
        attachment_type_id=a.attachment_type_id,
        type_code=type_row["type_code"] if type_row else None,
        type_name=type_row["type_name"] if type_row else None,
        lot_id=a.lot_id,
        reception_id=a.reception_id,
        analysis_id=a.analysis_id,
        file_url=a.file_url,
        file_name=a.file_name,
        mime_type=a.mime_type,
        file_size_bytes=a.file_size_bytes,
        comment=a.comment,
        uploaded_by=a.uploaded_by,
        uploaded_by_name=user_name,
        uploaded_at=a.uploaded_at,
    )


@router.post("", response_model=AttachmentRead, status_code=201)
async def upload(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
    lot_id: int | None = Form(None),
    analysis_id: int | None = Form(None),
    reception_id: int | None = Form(None),
    type_code: str | None = Form(None),
    comment: str | None = Form(None),
):
    if not file.filename:
        raise HTTPException(400, "Sin nombre de fichero")

    lot_id_resolved = _resolve_lot_id(db, lot_id, analysis_id, reception_id)
    type_id = _resolve_attachment_type(db, type_code)

    # Carpeta por lote
    lot_dir = UPLOAD_DIR / str(lot_id_resolved)
    lot_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = lot_dir / stored_name

    # Volcado con tope de tamaño
    written = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    413, f"Fichero supera el máximo permitido de {settings.upload_max_mb} MB"
                )
            out.write(chunk)

    file_url = f"/uploads/{lot_id_resolved}/{stored_name}"

    att = Attachment(
        attachment_type_id=type_id,
        lot_id=lot_id_resolved,
        reception_id=reception_id,
        analysis_id=analysis_id,
        file_url=file_url,
        file_name=file.filename,
        mime_type=file.content_type,
        file_size_bytes=written,
        comment=comment,
        uploaded_by=user.user_id,
    )
    db.add(att)
    try:
        db.commit()
        db.refresh(att)
    except Exception as e:
        db.rollback()
        dest.unlink(missing_ok=True)
        raise HTTPException(400, f"Error al guardar metadatos: {e}") from e

    return _to_read(db, att)


@router.get("", response_model=list[AttachmentRead])
def list_attachments(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    lot_id: int | None = None,
    analysis_id: int | None = None,
    reception_id: int | None = None,
):
    if not (lot_id or analysis_id or reception_id):
        raise HTTPException(400, "Filtra por lot_id, analysis_id o reception_id")

    q = select(Attachment).order_by(Attachment.uploaded_at.desc())
    if lot_id:
        q = q.where(Attachment.lot_id == lot_id)
    if analysis_id:
        q = q.where(Attachment.analysis_id == analysis_id)
    if reception_id:
        q = q.where(Attachment.reception_id == reception_id)
    rows = db.execute(q).scalars().all()
    return [_to_read(db, a) for a in rows]


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: int,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(404, "No encontrado")

    # Borrar fichero físico (best-effort)
    try:
        url_path = att.file_url.lstrip("/")  # 'uploads/<lot>/<name>'
        parts = url_path.split("/", 1)
        if len(parts) == 2 and parts[0] == "uploads":
            (UPLOAD_DIR / parts[1]).unlink(missing_ok=True)
    except Exception:
        pass

    db.delete(att)
    db.commit()
    return None
