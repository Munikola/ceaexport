"""Schemas Pydantic para operaciones (recepciones y lotes)."""
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ── Lote (sub-objeto creado dentro de una recepción) ─────────────────

class LotInReceptionCreate(BaseModel):
    """Datos de un lote tal como llega en el payload de creación de recepción."""
    lot_code: str = Field(..., min_length=1, max_length=50)
    client_lot_code: str | None = None
    lot_year: int | None = None  # si no viene, se deriva de reception_date
    lot_category_id: int | None = None  # si no viene, se asume "comercial"
    supplier_id: int
    origin_id: int | None = None
    pond_id: int | None = None
    product_type: str = Field(..., pattern="^(ENTERO|COLA)$")
    fishing_date: date | None = None
    chemical_id: int | None = None
    treater_ids: list[int] = []
    observations: str | None = None
    # En reception_lots
    received_lbs: Decimal | None = None
    boxes_count: int | None = None
    bins_count: int | None = None
    delivery_index: int = 1


class LotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lot_id: int
    lot_code: str
    lot_year: int
    client_lot_code: str | None
    plant_id: int | None
    supplier_id: int | None
    origin_id: int | None
    pond_id: int | None
    lot_category_id: int | None
    product_type: str | None
    fishing_date: date | None
    chemical_id: int | None
    observations: str | None
    created_at: datetime


# ── Reception ─────────────────────────────────────────────────────────

class ReceptionCreate(BaseModel):
    """Payload para crear una recepción con N lotes en una transacción."""
    plant_id: int
    truck_id: int | None = None
    driver_id: int | None = None
    logistics_company_id: int | None = None
    reception_date: date
    arrival_time: time | None = None

    remission_guide_number: str | None = None
    sri_access_key: str | None = Field(None, max_length=49)
    warranty_letter_number: str | None = None
    arrival_temperature: Decimal | None = None

    truck_condition_id: int | None = None
    ice_condition_id: int | None = None
    hygiene_condition_id: int | None = None

    observations: str | None = None
    lots: list[LotInReceptionCreate] = Field(..., min_length=1)


class ReceptionLotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reception_lot_id: int
    lot_id: int
    delivery_index: int
    received_lbs: Decimal | None
    boxes_count: int | None
    bins_count: int | None
    lot: LotRead


class ReceptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reception_id: int
    plant_id: int
    truck_id: int | None
    driver_id: int | None
    logistics_company_id: int | None
    reception_date: date
    arrival_time: time | None
    remission_guide_number: str | None
    sri_access_key: str | None
    arrival_temperature: Decimal | None
    truck_condition_id: int | None
    ice_condition_id: int | None
    hygiene_condition_id: int | None
    observations: str | None
    created_at: datetime
    reception_lots: list[ReceptionLotRead]


class ReceptionSummary(BaseModel):
    """Resumen ligero para listados (bandeja, búsqueda)."""
    model_config = ConfigDict(from_attributes=True)

    reception_id: int
    reception_date: date
    arrival_time: time | None
    plant_id: int
    plate_number: str | None = None
    driver_name: str | None = None
    logistics_name: str | None = None
    lot_count: int = 0
    total_lbs: Decimal | None = None
