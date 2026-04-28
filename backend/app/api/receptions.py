"""Endpoints de recepciones de camión con lotes anidados."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import CurrentUser, can_create_receptions
from app.models.catalogs import LotCategory, Treater
from app.models.operations import Lot, Reception, ReceptionLot
from app.schemas.operations import (
    LotInReceptionCreate,
    ReceptionCreate,
    ReceptionRead,
    ReceptionSummary,
)

router = APIRouter(prefix="/receptions", tags=["receptions"])


def _ensure_can_create(user) -> None:
    if not can_create_receptions(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no puede crear recepciones",
        )


def _resolve_lot_category(db: Session, lot_payload: LotInReceptionCreate) -> int | None:
    if lot_payload.lot_category_id is not None:
        return lot_payload.lot_category_id
    # default: comercial
    cat = db.execute(
        select(LotCategory).where(LotCategory.category_code == "comercial")
    ).scalar_one_or_none()
    return cat.lot_category_id if cat else None


def _create_or_attach_lot(
    db: Session,
    plant_id: int,
    lot_year: int,
    payload: LotInReceptionCreate,
    created_by: int,
) -> tuple[Lot, int]:
    """Devuelve (lote, delivery_index efectivo).

    Si ya existe un lote con (lot_code, lot_year), se reutiliza y se incrementa
    el delivery_index. Si no, se crea uno nuevo.
    """
    existing = db.execute(
        select(Lot).where(Lot.lot_code == payload.lot_code, Lot.lot_year == lot_year)
    ).scalar_one_or_none()

    if existing:
        # Calcular el siguiente delivery_index para este lote
        max_idx = db.execute(
            select(ReceptionLot.delivery_index)
            .where(ReceptionLot.lot_id == existing.lot_id)
            .order_by(ReceptionLot.delivery_index.desc())
        ).scalar()
        return existing, (max_idx or 0) + 1

    lot = Lot(
        lot_code=payload.lot_code,
        lot_year=lot_year,
        client_lot_code=payload.client_lot_code,
        plant_id=plant_id,
        supplier_id=payload.supplier_id,
        origin_id=payload.origin_id,
        pond_id=payload.pond_id,
        lot_category_id=_resolve_lot_category(db, payload),
        product_type=payload.product_type,
        fishing_date=payload.fishing_date,
        chemical_id=payload.chemical_id,
        observations=payload.observations,
        created_by=created_by,
    )
    db.add(lot)
    db.flush()  # obtener lot_id

    # Asociar tratadores
    if payload.treater_ids:
        treaters = db.execute(
            select(Treater).where(Treater.treater_id.in_(payload.treater_ids))
        ).scalars().all()
        lot.treaters = treaters

    return lot, payload.delivery_index


@router.post("", response_model=ReceptionRead, status_code=201)
def create_reception(
    payload: ReceptionCreate,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    _ensure_can_create(user)

    reception = Reception(
        plant_id=payload.plant_id,
        truck_id=payload.truck_id,
        driver_id=payload.driver_id,
        logistics_company_id=payload.logistics_company_id,
        reception_date=payload.reception_date,
        arrival_time=payload.arrival_time,
        remission_guide_number=payload.remission_guide_number,
        sri_access_key=payload.sri_access_key,
        warranty_letter_number=payload.warranty_letter_number,
        arrival_temperature=payload.arrival_temperature,
        truck_condition_id=payload.truck_condition_id,
        ice_condition_id=payload.ice_condition_id,
        hygiene_condition_id=payload.hygiene_condition_id,
        observations=payload.observations,
        created_by=user.user_id,
    )
    db.add(reception)
    db.flush()

    lot_year_default = payload.reception_date.year

    for idx, lot_payload in enumerate(payload.lots, start=1):
        lot_year = lot_payload.lot_year or lot_year_default
        lot, delivery_index = _create_or_attach_lot(
            db, payload.plant_id, lot_year, lot_payload, user.user_id
        )

        rl = ReceptionLot(
            reception_id=reception.reception_id,
            lot_id=lot.lot_id,
            sequence_in_reception=idx,
            delivery_index=delivery_index,
            received_lbs=lot_payload.received_lbs,
            boxes_count=lot_payload.boxes_count,
            bins_count=lot_payload.bins_count,
        )
        db.add(rl)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al guardar: {e}") from e

    db.refresh(reception)
    return reception


@router.get("", response_model=list[ReceptionSummary])
def list_receptions(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
):
    receptions = db.execute(
        select(Reception)
        .order_by(Reception.reception_date.desc(), Reception.created_at.desc())
        .limit(limit)
    ).scalars().all()

    summaries = []
    for r in receptions:
        total_lbs = sum((rl.received_lbs or 0 for rl in r.reception_lots), start=0)
        summaries.append(
            ReceptionSummary(
                reception_id=r.reception_id,
                reception_date=r.reception_date,
                arrival_time=r.arrival_time,
                plant_id=r.plant_id,
                plate_number=r.truck.plate_number if r.truck else None,
                driver_name=r.driver.full_name if r.driver else None,
                logistics_name=r.logistics_company.company_name if r.logistics_company else None,
                lot_count=len(r.reception_lots),
                total_lbs=total_lbs if total_lbs else None,
            )
        )
    return summaries


@router.get("/{reception_id}", response_model=ReceptionRead)
def get_reception(
    reception_id: int,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    r = db.get(Reception, reception_id)
    if not r:
        raise HTTPException(status_code=404, detail="Recepción no encontrada")
    return r
