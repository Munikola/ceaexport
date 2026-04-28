"""Modelos ORM del análisis de calidad (R-CC-001).

Cubre: cabecera del análisis, M:N con lotes, 3 muestreos con sus defectos,
organoléptico crudo+cocido (color/sabor/olor) y mini-histograma del paper.
"""
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.operations import PRODUCT_TYPE_ENUM


# ENUMs Postgres ya creados por db/schema.sql.
SHIFT_TYPE_ENUM = SAEnum("T/D", "T/N", name="shift_type", create_type=False)
SAMPLE_STATE_ENUM = SAEnum("crudo", "cocido", name="sample_state", create_type=False)
ANALYSIS_STATUS_ENUM = SAEnum(
    "borrador", "en_revision", "validado", "rechazado",
    name="analysis_status", create_type=False,
)


class QualityAnalysis(Base):
    __tablename__ = "quality_analyses"

    analysis_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.plant_id"), nullable=False)
    analysis_date: Mapped[date] = mapped_column(Date, nullable=False)
    analysis_time: Mapped[time | None] = mapped_column(Time)
    shift: Mapped[str | None] = mapped_column(SHIFT_TYPE_ENUM)
    analyst_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))

    sample_total_weight: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    total_units: Mapped[int | None] = mapped_column(Integer)
    global_grammage: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    so2_residual_ppm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    so2_global: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    average_grammage: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    average_classification_code: Mapped[str | None] = mapped_column(String(20))
    product_temperature: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    gr_cc: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    c_kg: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    gr_sc: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    c_kg2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    decision_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("decisions.decision_id"))
    destined_product_type: Mapped[str | None] = mapped_column(PRODUCT_TYPE_ENUM)
    global_defect_percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    good_product_percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    general_observations: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(ANALYSIS_STATUS_ENUM, default="borrador")

    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Relaciones (selectin para que la respuesta /api/analyses/{id} traiga todo)
    analysis_lots: Mapped[list["AnalysisLot"]] = relationship(
        back_populates="analysis", lazy="selectin", cascade="all, delete-orphan"
    )
    samplings: Mapped[list["AnalysisSampling"]] = relationship(
        back_populates="analysis", lazy="selectin", cascade="all, delete-orphan",
        order_by="AnalysisSampling.sampling_index",
    )
    colors: Mapped[list["AnalysisColor"]] = relationship(
        back_populates="analysis", lazy="selectin", cascade="all, delete-orphan",
    )
    flavors: Mapped[list["AnalysisFlavor"]] = relationship(
        back_populates="analysis", lazy="selectin", cascade="all, delete-orphan",
    )
    odors: Mapped[list["AnalysisOdor"]] = relationship(
        back_populates="analysis", lazy="selectin", cascade="all, delete-orphan",
    )
    size_distribution: Mapped[list["AnalysisSizeDistribution"]] = relationship(
        back_populates="analysis", lazy="selectin", cascade="all, delete-orphan",
    )


class AnalysisLot(Base):
    """M:N quality_analyses ↔ lots."""
    __tablename__ = "analysis_lots"

    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="CASCADE"), primary_key=True
    )
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lots.lot_id", ondelete="CASCADE"), primary_key=True
    )
    contribution_lbs: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    analysis: Mapped[QualityAnalysis] = relationship(back_populates="analysis_lots")


class AnalysisSampling(Base):
    """1er, 2do, 3er muestreo del R-CC-001."""
    __tablename__ = "analysis_samplings"

    sampling_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="CASCADE")
    )
    sampling_index: Mapped[int] = mapped_column(Integer, nullable=False)
    units_count: Mapped[int | None] = mapped_column(Integer)
    defect_units: Mapped[int | None] = mapped_column(Integer)
    good_units: Mapped[int | None] = mapped_column(Integer)
    defect_percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    good_percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    so2_ppm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    analysis: Mapped[QualityAnalysis] = relationship(back_populates="samplings")
    defects: Mapped[list["SamplingDefect"]] = relationship(
        back_populates="sampling", lazy="selectin", cascade="all, delete-orphan"
    )


class SamplingDefect(Base):
    __tablename__ = "sampling_defects"

    sampling_defect_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sampling_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("analysis_samplings.sampling_id", ondelete="CASCADE")
    )
    defect_id: Mapped[int] = mapped_column(Integer, ForeignKey("defects.defect_id"), nullable=False)
    units_count: Mapped[int | None] = mapped_column(Integer)
    percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    sampling: Mapped[AnalysisSampling] = relationship(back_populates="defects")


# ── Organoléptico (crudo + cocido) ───────────────────────────────────

class AnalysisColor(Base):
    __tablename__ = "analysis_colors"

    analysis_color_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="CASCADE")
    )
    sample_state: Mapped[str] = mapped_column(SAMPLE_STATE_ENUM, nullable=False)
    color_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("colors.color_id"))

    analysis: Mapped[QualityAnalysis] = relationship(back_populates="colors")


class AnalysisFlavor(Base):
    __tablename__ = "analysis_flavors"

    analysis_flavor_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="CASCADE")
    )
    sample_state: Mapped[str] = mapped_column(SAMPLE_STATE_ENUM, nullable=False)
    flavor_id: Mapped[int] = mapped_column(Integer, ForeignKey("flavors.flavor_id"), nullable=False)
    intensity_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("intensities.intensity_id"))
    percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    analysis: Mapped[QualityAnalysis] = relationship(back_populates="flavors")


class AnalysisOdor(Base):
    __tablename__ = "analysis_odors"

    analysis_odor_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="CASCADE")
    )
    sample_state: Mapped[str] = mapped_column(SAMPLE_STATE_ENUM, nullable=False)
    odor_id: Mapped[int] = mapped_column(Integer, ForeignKey("odors.odor_id"), nullable=False)
    intensity_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("intensities.intensity_id"))
    presence: Mapped[bool] = mapped_column(Boolean, default=False)
    observations: Mapped[str | None] = mapped_column(Text)

    analysis: Mapped[QualityAnalysis] = relationship(back_populates="odors")


# ── Mini-histograma del R-CC-001 ─────────────────────────────────────

class AnalysisSizeDistribution(Base):
    __tablename__ = "analysis_size_distribution"

    distribution_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quality_analyses.analysis_id", ondelete="CASCADE")
    )
    cc_classification_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("cc_classifications.cc_classification_id")
    )
    weight_grams: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    units_count: Mapped[int | None] = mapped_column(Integer)
    average_grammage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    analysis: Mapped[QualityAnalysis] = relationship(back_populates="size_distribution")
