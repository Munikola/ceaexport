"""Endpoints de análisis de calidad (R-CC-001).

- GET  /api/analyses/pending           → bandeja de lotes sin análisis cerrado
- POST /api/analyses                   → crea/actualiza análisis (idempotente por lotes)
- GET  /api/analyses/{id}              → ficha completa para edición
- GET  /api/analyses/by-lot/{lot_id}   → análisis vigente del lote (si existe)
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import CurrentUser, can_create_analyses
from app.models.analyses import (
    AnalysisColor,
    AnalysisFlavor,
    AnalysisLot,
    AnalysisOdor,
    AnalysisSampling,
    AnalysisSizeDistribution,
    QualityAnalysis,
    SamplingDefect,
)
from app.models.operations import Lot
from app.schemas.analyses import (
    AnalysisLotRead,
    AnalysisRead,
    AnalysisUpsert,
    LotBoardRow,
    LotContext,
    LotReceptionInfo,
    PendingAnalysisRow,
)

router = APIRouter(prefix="/analyses", tags=["analyses"])


def _ensure_can_create(user) -> None:
    if not can_create_analyses(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no puede registrar análisis",
        )


# ── Bandeja ──────────────────────────────────────────────────────────

@router.get("/pending", response_model=list[PendingAnalysisRow])
def list_pending(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Lee directamente la vista `v_pending_analyses` (lotes sin análisis cerrado)."""
    rows = db.execute(text("SELECT * FROM v_pending_analyses")).mappings().all()
    return [PendingAnalysisRow(**dict(r)) for r in rows]


@router.get("/board", response_model=list[LotBoardRow])
def list_board(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    state: str | None = None,
):
    """Tablero general: todos los lotes con su último análisis (si existe).

    `state` opcional filtra por: pendiente | en_analisis | liberado | rechazado.
    """
    sql = "SELECT * FROM v_lot_board"
    params: dict = {}
    if state:
        sql += " WHERE board_state = :state"
        params["state"] = state
    rows = db.execute(text(sql), params).mappings().all()
    return [LotBoardRow(**dict(r)) for r in rows]


@router.get("/lot-context/{lot_id}", response_model=LotContext)
def get_lot_context(
    lot_id: int,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Devuelve el lote con todas sus entregas (camiones), para mostrar en la ficha."""
    head = db.execute(
        text(
            """
            SELECT
                l.lot_id, l.lot_code, l.lot_year, l.product_type, l.fishing_date,
                s.supplier_name, o.origin_name, pn.pond_code AS psc,
                ch.chemical_name,
                COALESCE(SUM(rl.received_lbs), 0) AS total_lbs,
                MIN(r.plant_id) AS plant_id,
                MIN(p.plant_name) AS plant_name
            FROM lots l
            LEFT JOIN suppliers s  ON l.supplier_id = s.supplier_id
            LEFT JOIN origins   o  ON l.origin_id   = o.origin_id
            LEFT JOIN ponds     pn ON l.pond_id     = pn.pond_id
            LEFT JOIN chemicals ch ON l.chemical_id = ch.chemical_id
            LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
            LEFT JOIN receptions     r  ON rl.reception_id = r.reception_id
            LEFT JOIN plants         p  ON r.plant_id = p.plant_id
            WHERE l.lot_id = :lid
            GROUP BY l.lot_id, l.lot_code, l.lot_year, l.product_type, l.fishing_date,
                     s.supplier_name, o.origin_name, pn.pond_code, ch.chemical_name
            """
        ),
        {"lid": lot_id},
    ).mappings().first()
    if not head:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    treaters = db.execute(
        text(
            "SELECT t.full_name FROM lot_treaters lt "
            "JOIN treaters t ON lt.treater_id = t.treater_id "
            "WHERE lt.lot_id = :lid ORDER BY t.full_name"
        ),
        {"lid": lot_id},
    ).scalars().all()

    receptions = db.execute(
        text(
            """
            SELECT
                r.reception_id, r.reception_date, r.arrival_time,
                rl.delivery_index, rl.received_lbs, rl.boxes_count, rl.bins_count,
                r.arrival_temperature, r.remission_guide_number, r.warranty_letter_number,
                r.observations,
                t.plate_number, d.full_name AS driver_name, lc.company_name AS logistics_name,
                pl.plant_name,
                tc.condition_name AS truck_condition,
                ic.condition_name AS ice_condition,
                hc.condition_name AS hygiene_condition
            FROM reception_lots rl
            JOIN receptions r ON rl.reception_id = r.reception_id
            LEFT JOIN trucks              t  ON r.truck_id = t.truck_id
            LEFT JOIN drivers             d  ON r.driver_id = d.driver_id
            LEFT JOIN logistics_companies lc ON r.logistics_company_id = lc.logistics_company_id
            LEFT JOIN plants              pl ON r.plant_id = pl.plant_id
            LEFT JOIN condition_levels    tc ON r.truck_condition_id   = tc.condition_id
            LEFT JOIN condition_levels    ic ON r.ice_condition_id     = ic.condition_id
            LEFT JOIN condition_levels    hc ON r.hygiene_condition_id = hc.condition_id
            WHERE rl.lot_id = :lid
            ORDER BY rl.delivery_index, r.reception_date, r.arrival_time
            """
        ),
        {"lid": lot_id},
    ).mappings().all()

    return LotContext(
        **dict(head),
        treaters=list(treaters),
        receptions=[LotReceptionInfo(**dict(r)) for r in receptions],
    )


# ── Lectura ──────────────────────────────────────────────────────────

def _build_analysis_lots(db: Session, analysis: QualityAnalysis) -> list[AnalysisLotRead]:
    """Carga los lotes vinculados al análisis con sus datos visibles en cabecera."""
    rows = db.execute(
        text(
            """
            SELECT
                l.lot_id, l.lot_code, l.lot_year, l.product_type,
                s.supplier_name, o.origin_name, p.pond_code AS psc,
                COALESCE(SUM(rl.received_lbs), 0) AS total_lbs,
                MAX(al.contribution_lbs) AS contribution_lbs
            FROM analysis_lots al
            JOIN lots l ON al.lot_id = l.lot_id
            LEFT JOIN suppliers s ON l.supplier_id = s.supplier_id
            LEFT JOIN origins   o ON l.origin_id   = o.origin_id
            LEFT JOIN ponds     p ON l.pond_id     = p.pond_id
            LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
            WHERE al.analysis_id = :aid
            GROUP BY l.lot_id, l.lot_code, l.lot_year, l.product_type,
                     s.supplier_name, o.origin_name, p.pond_code
            ORDER BY l.lot_code
            """
        ),
        {"aid": analysis.analysis_id},
    ).mappings().all()
    return [AnalysisLotRead(**dict(r)) for r in rows]


def _read(db: Session, analysis: QualityAnalysis) -> AnalysisRead:
    base = AnalysisRead.model_validate(analysis)
    base.lots = _build_analysis_lots(db, analysis)
    return base


@router.get("/by-lot/{lot_id}", response_model=AnalysisRead | None)
def get_by_lot(
    lot_id: int,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Devuelve el análisis más reciente del lote (si existe)."""
    qa = db.execute(
        select(QualityAnalysis)
        .join(AnalysisLot, AnalysisLot.analysis_id == QualityAnalysis.analysis_id)
        .where(AnalysisLot.lot_id == lot_id)
        .order_by(QualityAnalysis.analysis_date.desc(), QualityAnalysis.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if qa is None:
        return None
    return _read(db, qa)


@router.get("/{analysis_id}", response_model=AnalysisRead)
def get_analysis(
    analysis_id: int,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    qa = db.get(QualityAnalysis, analysis_id)
    if not qa:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return _read(db, qa)


# ── Crear / actualizar (upsert por idempotencia) ─────────────────────

def _replace_collections(db: Session, qa: QualityAnalysis, payload: AnalysisUpsert) -> None:
    """Reemplaza por completo las colecciones del análisis (atomic-replace).

    El payload trae el estado completo de samplings, colores, sabores, olores y
    size_distribution. Borrar + insertar es la opción más simple y robusta para
    formularios de tipo "guardar todo".
    """
    # Borrar hijos existentes (sampling_defects caen en cascada al borrar samplings)
    db.query(AnalysisSampling).filter(AnalysisSampling.analysis_id == qa.analysis_id).delete()
    db.query(AnalysisColor).filter(AnalysisColor.analysis_id == qa.analysis_id).delete()
    db.query(AnalysisFlavor).filter(AnalysisFlavor.analysis_id == qa.analysis_id).delete()
    db.query(AnalysisOdor).filter(AnalysisOdor.analysis_id == qa.analysis_id).delete()
    db.query(AnalysisSizeDistribution).filter(
        AnalysisSizeDistribution.analysis_id == qa.analysis_id
    ).delete()
    db.flush()

    for s in payload.samplings:
        sampling = AnalysisSampling(
            analysis_id=qa.analysis_id,
            sampling_index=s.sampling_index,
            units_count=s.units_count,
            defect_units=s.defect_units,
            good_units=s.good_units,
            defect_percentage=s.defect_percentage,
            good_percentage=s.good_percentage,
            so2_ppm=s.so2_ppm,
        )
        db.add(sampling)
        db.flush()
        for d in s.defects:
            db.add(SamplingDefect(
                sampling_id=sampling.sampling_id,
                defect_id=d.defect_id,
                units_count=d.units_count,
                percentage=d.percentage,
            ))

    for c in payload.colors:
        db.add(AnalysisColor(
            analysis_id=qa.analysis_id,
            sample_state=c.sample_state,
            color_id=c.color_id,
        ))

    for f in payload.flavors:
        db.add(AnalysisFlavor(
            analysis_id=qa.analysis_id,
            sample_state=f.sample_state,
            flavor_id=f.flavor_id,
            intensity_id=f.intensity_id,
            percentage=f.percentage,
        ))

    for o in payload.odors:
        db.add(AnalysisOdor(
            analysis_id=qa.analysis_id,
            sample_state=o.sample_state,
            odor_id=o.odor_id,
            intensity_id=o.intensity_id,
            presence=o.presence,
            observations=o.observations,
        ))

    for sd in payload.size_distribution:
        db.add(AnalysisSizeDistribution(
            analysis_id=qa.analysis_id,
            cc_classification_id=sd.cc_classification_id,
            weight_grams=sd.weight_grams,
            units_count=sd.units_count,
            average_grammage=sd.average_grammage,
        ))


def _sync_lots(db: Session, qa: QualityAnalysis, lot_ids: list[int]) -> None:
    """Sincroniza analysis_lots con la lista del payload."""
    if not lot_ids:
        raise HTTPException(status_code=400, detail="El análisis necesita al menos un lote")

    # Validar que existan
    found = db.execute(select(Lot.lot_id).where(Lot.lot_id.in_(lot_ids))).scalars().all()
    missing = set(lot_ids) - set(found)
    if missing:
        raise HTTPException(status_code=400, detail=f"Lotes inexistentes: {sorted(missing)}")

    db.query(AnalysisLot).filter(AnalysisLot.analysis_id == qa.analysis_id).delete()
    db.flush()
    for lid in lot_ids:
        db.add(AnalysisLot(analysis_id=qa.analysis_id, lot_id=lid))


def _apply_header(qa: QualityAnalysis, payload: AnalysisUpsert, user_id: int) -> None:
    qa.plant_id = payload.plant_id
    qa.analysis_date = payload.analysis_date
    qa.analysis_time = payload.analysis_time
    qa.shift = payload.shift
    qa.analyst_id = payload.analyst_id or user_id
    qa.sample_total_weight = payload.sample_total_weight
    qa.total_units = payload.total_units
    qa.global_grammage = payload.global_grammage
    qa.so2_residual_ppm = payload.so2_residual_ppm
    qa.so2_global = payload.so2_global
    qa.average_grammage = payload.average_grammage
    qa.average_classification_code = payload.average_classification_code
    qa.product_temperature = payload.product_temperature
    qa.gr_cc = payload.gr_cc
    qa.c_kg = payload.c_kg
    qa.gr_sc = payload.gr_sc
    qa.c_kg2 = payload.c_kg2
    qa.decision_id = payload.decision_id
    qa.destined_product_type = payload.destined_product_type
    qa.global_defect_percentage = payload.global_defect_percentage
    qa.good_product_percentage = payload.good_product_percentage
    qa.general_observations = payload.general_observations
    qa.status = payload.status


def _validate_close(payload: AnalysisUpsert) -> None:
    """Reglas de negocio antes de tocar la BD (mensajes amigables)."""
    if payload.status in ("validado", "rechazado") and payload.decision_id is None:
        raise HTTPException(
            status_code=400,
            detail="Para liberar o rechazar el análisis debes seleccionar una decisión.",
        )


def _save_or_400(db: Session) -> None:
    """Hace flush+commit y traduce errores de BD a 400 con detalle legible."""
    from sqlalchemy.exc import IntegrityError, DataError

    try:
        db.flush()
        db.commit()
    except IntegrityError as e:
        db.rollback()
        msg = str(e.orig) if e.orig else str(e)
        # Constraint del schema cuando se cierra sin decisión
        if "chk_closed_has_decision" in msg:
            raise HTTPException(
                status_code=400,
                detail="Para liberar o rechazar debes seleccionar una decisión.",
            ) from e
        raise HTTPException(status_code=400, detail=f"Error de integridad: {msg}") from e
    except DataError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Datos inválidos: {e.orig}") from e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al guardar: {e}") from e


@router.post("", response_model=AnalysisRead, status_code=201)
def create_analysis(
    payload: AnalysisUpsert,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    _ensure_can_create(user)
    _validate_close(payload)

    qa = QualityAnalysis(created_by=user.user_id)
    _apply_header(qa, payload, user.user_id)
    db.add(qa)
    db.flush()

    _sync_lots(db, qa, payload.lot_ids)
    _replace_collections(db, qa, payload)
    _save_or_400(db)

    db.refresh(qa)
    return _read(db, qa)


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(
    analysis_id: int,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Borra el análisis (y por cascada todas sus secciones)."""
    _ensure_can_create(user)
    qa = db.get(QualityAnalysis, analysis_id)
    if not qa:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    db.delete(qa)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error al eliminar: {e}") from e
    return None


@router.put("/{analysis_id}", response_model=AnalysisRead)
def update_analysis(
    analysis_id: int,
    payload: AnalysisUpsert,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    _ensure_can_create(user)
    _validate_close(payload)

    qa = db.get(QualityAnalysis, analysis_id)
    if not qa:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    if qa.status in ("validado", "rechazado"):
        raise HTTPException(status_code=400, detail="Análisis cerrado, no se puede editar")

    _apply_header(qa, payload, user.user_id)
    _sync_lots(db, qa, payload.lot_ids)
    _replace_collections(db, qa, payload)
    _save_or_400(db)

    db.refresh(qa)
    return _read(db, qa)
