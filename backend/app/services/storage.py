"""Abstracción de almacenamiento de ficheros.

Dos backends:
- 'local': filesystem bajo `backend/uploads/<lot_id>/<uuid>.<ext>`. Útil en dev.
- 'gcs':   Google Cloud Storage `gs://<bucket>/<lot_id>/<uuid>.<ext>`. Producción.

La elección la hace `settings.storage_backend`. La interfaz pública es la misma:
- `save(stream, lot_id, filename) -> StoredFile`
- `delete(stored_path)`
- `signed_url(stored_path) -> str` (URL pública o firmada para devolver al cliente)
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import IO

from fastapi import HTTPException

from app.core.config import get_settings

settings = get_settings()
MAX_BYTES = settings.upload_max_mb * 1024 * 1024


@dataclass
class StoredFile:
    """Resultado de un save(). `path` es el identificador interno que
    guardamos en BD (se le pasa luego a delete/signed_url)."""
    path: str           # local: 'uploads/<lot_id>/<name>'  ·  gcs: '<lot_id>/<name>'
    file_url: str       # URL servible al cliente (estática local o signed URL)
    size_bytes: int


class _LocalStorage:
    """Backend filesystem (modo dev)."""

    def __init__(self, base: Path):
        self.base = base.resolve()
        self.base.mkdir(parents=True, exist_ok=True)

    async def save(self, source: IO, lot_id: int, filename: str) -> StoredFile:
        ext = Path(filename).suffix.lower()
        stored_name = f"{uuid.uuid4().hex}{ext}"
        lot_dir = self.base / str(lot_id)
        lot_dir.mkdir(parents=True, exist_ok=True)
        dest = lot_dir / stored_name

        written = 0
        with dest.open("wb") as out:
            while True:
                chunk = await source.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > MAX_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        413,
                        f"Fichero supera el máximo de {settings.upload_max_mb} MB",
                    )
                out.write(chunk)

        relative = f"uploads/{lot_id}/{stored_name}"
        return StoredFile(
            path=relative,
            file_url=f"/{relative}",  # servido por StaticFiles en main.py
            size_bytes=written,
        )

    def delete(self, stored_path: str) -> None:
        # stored_path = 'uploads/<lot>/<name>'
        try:
            parts = stored_path.lstrip("/").split("/", 1)
            if len(parts) == 2 and parts[0] == "uploads":
                (self.base / parts[1]).unlink(missing_ok=True)
        except Exception:
            pass

    def signed_url(self, stored_path: str) -> str:
        # En local no hay firma, devolvemos la ruta tal cual.
        return f"/{stored_path.lstrip('/')}"


class _GCSStorage:
    """Backend Google Cloud Storage (modo producción)."""

    def __init__(self, bucket_name: str, signed_url_expires: int):
        from google.cloud import storage  # import perezoso (no romper si no instalado en dev)
        self._storage_module = storage
        self._client = storage.Client()
        self.bucket_name = bucket_name
        self.bucket = self._client.bucket(bucket_name)
        self.signed_url_expires = signed_url_expires

    async def save(self, source: IO, lot_id: int, filename: str) -> StoredFile:
        ext = Path(filename).suffix.lower()
        stored_name = f"{uuid.uuid4().hex}{ext}"
        object_path = f"{lot_id}/{stored_name}"

        # Volcar a memoria con tope de tamaño (las fotos rara vez >50 MB; OK).
        buffer = bytearray()
        while True:
            chunk = await source.read(1024 * 1024)
            if not chunk:
                break
            if len(buffer) + len(chunk) > MAX_BYTES:
                raise HTTPException(
                    413, f"Fichero supera el máximo de {settings.upload_max_mb} MB"
                )
            buffer.extend(chunk)

        blob = self.bucket.blob(object_path)
        blob.upload_from_string(bytes(buffer))

        return StoredFile(
            path=object_path,
            file_url=self._build_signed_url(object_path),
            size_bytes=len(buffer),
        )

    def delete(self, stored_path: str) -> None:
        try:
            self.bucket.blob(stored_path).delete()
        except Exception:
            pass

    def signed_url(self, stored_path: str) -> str:
        return self._build_signed_url(stored_path)

    def _build_signed_url(self, object_path: str) -> str:
        blob = self.bucket.blob(object_path)
        return blob.generate_signed_url(
            version="v4",
            expiration=timedelta(seconds=self.signed_url_expires),
            method="GET",
        )


def _build_storage():
    if settings.storage_backend == "gcs":
        if not settings.gcs_bucket:
            raise RuntimeError("STORAGE_BACKEND=gcs pero GCS_BUCKET no está configurado")
        return _GCSStorage(settings.gcs_bucket, settings.gcs_signed_url_expires)
    return _LocalStorage(Path(settings.upload_dir))


# Instancia única (lazy) usada por los endpoints.
_storage_singleton = None


def get_storage():
    global _storage_singleton
    if _storage_singleton is None:
        _storage_singleton = _build_storage()
    return _storage_singleton
