"""Schemas Pydantic para attachments."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    attachment_id: int
    attachment_type_id: int
    type_code: str | None = None
    type_name: str | None = None
    lot_id: int
    reception_id: int | None
    analysis_id: int | None
    file_url: str
    file_name: str | None
    mime_type: str | None
    file_size_bytes: int | None
    comment: str | None
    uploaded_by: int | None
    uploaded_by_name: str | None = None
    uploaded_at: datetime
