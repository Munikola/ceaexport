"""Schemas Pydantic para análisis de calidad (R-CC-001)."""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SampleState = Literal["crudo", "cocido"]
AnalysisStatus = Literal["borrador", "en_revision", "validado", "rechazado"]
ProductTypeStr = Literal["ENTERO", "COLA"]


# ── Bandeja de pendientes (lee de v_pending_analyses) ────────────────

class PendingAnalysisRow(BaseModel):
    """Fila de la bandeja: lote sin análisis validado/rechazado."""
    lot_id: int
    lot_code: str
    lot_year: int
    supplier_name: str | None = None
    origin_name: str | None = None
    psc: str | None = None
    product_type: str | None = None
    total_lbs: Decimal | None = None
    reception_date: date | None = None
    arrival_time: time | None = None
    planta: str | None = None
    plant_id: int | None = None
    hours_since_reception: float | None = None


class LotBoardRow(BaseModel):
    """Fila del tablero general — todos los lotes con su último análisis."""
    lot_id: int
    lot_code: str
    lot_year: int
    supplier_name: str | None = None
    origin_name: str | None = None
    psc: str | None = None
    product_type: str | None = None
    total_lbs: Decimal | None = None
    reception_date: date | None = None
    arrival_time: time | None = None
    planta: str | None = None
    plant_id: int | None = None
    hours_since_reception: float | None = None
    analysis_id: int | None = None
    analysis_status: str | None = None
    analysis_date: date | None = None
    analyst_id: int | None = None
    analyst_name: str | None = None
    decision_name: str | None = None
    attachment_count: int = 0
    board_state: str


class LotReceptionInfo(BaseModel):
    """Detalle de una entrega del lote (para mostrar trazabilidad en la ficha)."""
    reception_id: int
    reception_date: date
    arrival_time: time | None = None
    delivery_index: int = 1
    plate_number: str | None = None
    driver_name: str | None = None
    logistics_name: str | None = None
    arrival_temperature: Decimal | None = None
    received_lbs: Decimal | None = None
    boxes_count: int | None = None
    bins_count: int | None = None
    # Detalles para el modal "ver recepción"
    plant_name: str | None = None
    remission_guide_number: str | None = None
    warranty_letter_number: str | None = None
    truck_condition: str | None = None
    ice_condition: str | None = None
    hygiene_condition: str | None = None
    observations: str | None = None


class LotContext(BaseModel):
    """Contexto completo del lote: cabecera + todas sus entregas."""
    lot_id: int
    lot_code: str
    lot_year: int
    plant_id: int | None = None
    plant_name: str | None = None
    supplier_name: str | None = None
    origin_name: str | None = None
    psc: str | None = None
    product_type: str | None = None
    chemical_name: str | None = None
    treaters: list[str] = []
    fishing_date: date | None = None
    total_lbs: Decimal | None = None
    receptions: list[LotReceptionInfo] = []


# ── Sub-objetos del payload de análisis ──────────────────────────────

class SamplingDefectIO(BaseModel):
    defect_id: int
    units_count: int | None = None
    percentage: Decimal | None = None


class SamplingIO(BaseModel):
    sampling_index: int = Field(..., ge=1, le=3)
    units_count: int | None = None
    defect_units: int | None = None
    good_units: int | None = None
    defect_percentage: Decimal | None = None
    good_percentage: Decimal | None = None
    so2_ppm: Decimal | None = None
    defects: list[SamplingDefectIO] = []


class ColorIO(BaseModel):
    sample_state: SampleState
    color_id: int | None = None


class FlavorIO(BaseModel):
    sample_state: SampleState
    flavor_id: int
    intensity_id: int | None = None
    percentage: Decimal | None = None


class OdorIO(BaseModel):
    sample_state: SampleState
    odor_id: int
    intensity_id: int | None = None
    presence: bool = False
    observations: str | None = None


class SizeDistributionIO(BaseModel):
    cc_classification_id: int
    weight_grams: Decimal | None = None
    units_count: int | None = None
    average_grammage: Decimal | None = None


# ── Crear / actualizar análisis ──────────────────────────────────────

class AnalysisUpsert(BaseModel):
    """Payload completo: cabecera + secciones. Se reemplazan secciones enteras."""
    plant_id: int
    analysis_date: date
    analysis_time: time | None = None
    shift: str | None = None
    analyst_id: int | None = None

    sample_total_weight: Decimal | None = None
    total_units: int | None = None
    global_grammage: Decimal | None = None
    so2_residual_ppm: Decimal | None = None
    so2_global: Decimal | None = None
    average_grammage: Decimal | None = None
    average_classification_code: str | None = None
    product_temperature: Decimal | None = None

    gr_cc: Decimal | None = None
    c_kg: Decimal | None = None
    gr_sc: Decimal | None = None
    c_kg2: Decimal | None = None

    decision_id: int | None = None
    destined_product_type: ProductTypeStr | None = None
    global_defect_percentage: Decimal | None = None
    good_product_percentage: Decimal | None = None
    general_observations: str | None = None
    status: AnalysisStatus = "borrador"

    lot_ids: list[int] = Field(..., min_length=1)
    samplings: list[SamplingIO] = []
    colors: list[ColorIO] = []
    flavors: list[FlavorIO] = []
    odors: list[OdorIO] = []
    size_distribution: list[SizeDistributionIO] = []


# ── Lectura ───────────────────────────────────────────────────────────

class SamplingDefectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sampling_defect_id: int
    defect_id: int
    units_count: int | None
    percentage: Decimal | None


class SamplingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sampling_id: int
    sampling_index: int
    units_count: int | None
    defect_units: int | None
    good_units: int | None
    defect_percentage: Decimal | None
    good_percentage: Decimal | None
    so2_ppm: Decimal | None
    defects: list[SamplingDefectRead]


class ColorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    analysis_color_id: int
    sample_state: str
    color_id: int | None


class FlavorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    analysis_flavor_id: int
    sample_state: str
    flavor_id: int
    intensity_id: int | None
    percentage: Decimal | None


class OdorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    analysis_odor_id: int
    sample_state: str
    odor_id: int
    intensity_id: int | None
    presence: bool
    observations: str | None


class SizeDistributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    distribution_id: int
    cc_classification_id: int | None
    weight_grams: Decimal | None
    units_count: int | None
    average_grammage: Decimal | None


class AnalysisLotRead(BaseModel):
    """Lote vinculado al análisis con sus campos clave para mostrar en cabecera."""
    lot_id: int
    lot_code: str
    lot_year: int
    supplier_name: str | None = None
    origin_name: str | None = None
    psc: str | None = None
    product_type: str | None = None
    total_lbs: Decimal | None = None
    contribution_lbs: Decimal | None = None


class AnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    analysis_id: int
    plant_id: int
    analysis_date: date
    analysis_time: time | None
    shift: str | None
    analyst_id: int | None

    sample_total_weight: Decimal | None
    total_units: int | None
    global_grammage: Decimal | None
    so2_residual_ppm: Decimal | None
    so2_global: Decimal | None
    average_grammage: Decimal | None
    average_classification_code: str | None
    product_temperature: Decimal | None

    gr_cc: Decimal | None
    c_kg: Decimal | None
    gr_sc: Decimal | None
    c_kg2: Decimal | None

    decision_id: int | None
    destined_product_type: str | None
    global_defect_percentage: Decimal | None
    good_product_percentage: Decimal | None
    general_observations: str | None
    status: str

    created_at: datetime
    updated_at: datetime

    lots: list[AnalysisLotRead] = []
    samplings: list[SamplingRead] = []
    colors: list[ColorRead] = []
    flavors: list[FlavorRead] = []
    odors: list[OdorRead] = []
    size_distribution: list[SizeDistributionRead] = []


class AnalysisSummary(BaseModel):
    """Listado de análisis (no usado por la bandeja, pero sí para histórico)."""
    model_config = ConfigDict(from_attributes=True)
    analysis_id: int
    analysis_date: date
    analysis_time: time | None
    status: str
    decision_id: int | None
    lot_codes: list[str] = []
    plant_id: int
