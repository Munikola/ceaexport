"""Modelos ORM para fotos/documentos vinculados a lotes/recepciones/análisis."""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AttachmentType(Base):
    __tablename__ = "attachment_types"

    attachment_type_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Attachment(Base):
    __tablename__ = "attachments"

    attachment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attachment_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("attachment_types.attachment_type_id"), nullable=False
    )

    lot_id: Mapped[int] = mapped_column(Integer, ForeignKey("lots.lot_id", ondelete="CASCADE"), nullable=False)
    reception_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("receptions.reception_id", ondelete="SET NULL")
    )
    analysis_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="SET NULL")
    )
    histogram_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("lot_histograms.histogram_id", ondelete="SET NULL")
    )
    defect_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("defects.defect_id"))

    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    comment: Mapped[str | None] = mapped_column(Text)
    uploaded_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
