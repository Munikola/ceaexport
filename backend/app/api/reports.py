"""Endpoints de reportes: KPIs y agregados que alimentan Dashboard e Histogramas.

Todas las consultas son SQL directo sobre las views existentes (`v_lotes_recibidos`,
`v_supplier_performance`, `v_defects_by_lot`) — no se hace lógica de agregación
en Python. Esto deja el camino abierto para que Power BI use las MISMAS views.
"""
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import CurrentUser

router = APIRouter(prefix="/reports", tags=["reports"])


def _default_range(start: date | None, end: date | None) -> tuple[date, date]:
    """Por defecto: últimos 30 días."""
    today = date.today()
    if not end:
        end = today
    if not start:
        start = end - timedelta(days=30)
    return start, end


# ──────────────────────────────────────────────────────────────────
# DASHBOARD
# ──────────────────────────────────────────────────────────────────

@router.get("/dashboard/kpis")
def dashboard_kpis(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
) -> dict:
    """KPIs grandes para las cards de la cabecera del dashboard."""
    start, end = _default_range(start_date, end_date)

    row = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total_lots,
                ROUND(AVG(pct_defectos_global)::numeric, 1) AS avg_defect_pct,
                ROUND(AVG(so2_global)::numeric, 1)         AS avg_so2,
                COALESCE(ROUND(SUM(lbs_recibidas)::numeric, 0), 0) AS total_lbs,
                COUNT(*) FILTER (WHERE decision ILIKE '%rechaz%')  AS rejected_lots,
                COUNT(*) FILTER (WHERE decision ILIKE '%acept%')   AS accepted_lots
            FROM v_lotes_recibidos
            WHERE fecha_recepcion BETWEEN :start AND :end
            """
        ),
        {"start": start, "end": end},
    ).mappings().first()

    total = row["total_lots"] or 0
    rejected = row["rejected_lots"] or 0
    rejected_pct = round((rejected / total) * 100, 1) if total else 0

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_lots": total,
        "total_lbs": float(row["total_lbs"] or 0),
        "avg_defect_pct": float(row["avg_defect_pct"] or 0),
        "avg_so2": float(row["avg_so2"] or 0),
        "rejected_lots": rejected,
        "accepted_lots": row["accepted_lots"] or 0,
        "rejected_pct": rejected_pct,
    }


@router.get("/dashboard/lots-per-day")
def dashboard_lots_per_day(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    """Serie temporal: lotes recibidos por día, separados por decisión."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                fecha_recepcion AS date,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE decision ILIKE '%acept%')   AS aceptados,
                COUNT(*) FILTER (WHERE decision ILIKE '%rechaz%')  AS rechazados,
                COUNT(*) FILTER (WHERE decision ILIKE '%reproc%')  AS reproceso,
                COUNT(*) FILTER (WHERE decision IS NULL)           AS sin_decision
            FROM v_lotes_recibidos
            WHERE fecha_recepcion BETWEEN :start AND :end
            GROUP BY fecha_recepcion
            ORDER BY fecha_recepcion
            """
        ),
        {"start": start, "end": end},
    ).mappings().all()

    return [
        {
            "date": r["date"].isoformat() if r["date"] else None,
            "total": r["total"],
            "aceptados": r["aceptados"] or 0,
            "rechazados": r["rechazados"] or 0,
            "reproceso": r["reproceso"] or 0,
            "sin_decision": r["sin_decision"] or 0,
        }
        for r in rows
    ]


@router.get("/dashboard/top-suppliers-by-volume")
def dashboard_top_suppliers_by_volume(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT proveedor, SUM(lbs_recibidas) AS total_lbs, COUNT(*) AS lotes
            FROM v_lotes_recibidos
            WHERE fecha_recepcion BETWEEN :start AND :end
              AND proveedor IS NOT NULL
            GROUP BY proveedor
            ORDER BY total_lbs DESC NULLS LAST
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit},
    ).mappings().all()

    return [
        {
            "supplier": r["proveedor"],
            "total_lbs": float(r["total_lbs"] or 0),
            "lots": r["lotes"],
        }
        for r in rows
    ]


@router.get("/dashboard/top-suppliers-by-defects")
def dashboard_top_suppliers_by_defects(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    min_lots: int = Query(3, ge=1),
):
    """Proveedores con peor calidad — solo los que tienen al menos `min_lots`."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                proveedor,
                ROUND(AVG(pct_defectos_global)::numeric, 1) AS avg_defect_pct,
                COUNT(*) AS lotes
            FROM v_lotes_recibidos
            WHERE fecha_recepcion BETWEEN :start AND :end
              AND proveedor IS NOT NULL
              AND pct_defectos_global IS NOT NULL
            GROUP BY proveedor
            HAVING COUNT(*) >= :min_lots
            ORDER BY avg_defect_pct DESC NULLS LAST
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit, "min_lots": min_lots},
    ).mappings().all()

    return [
        {
            "supplier": r["proveedor"],
            "avg_defect_pct": float(r["avg_defect_pct"] or 0),
            "lots": r["lotes"],
        }
        for r in rows
    ]


@router.get("/dashboard/top-defects")
def dashboard_top_defects(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(10, ge=1, le=30),
):
    """Defectos más frecuentes en el periodo (% promedio)."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                defect_name,
                defect_category,
                ROUND(AVG(avg_percentage)::numeric, 1) AS avg_pct,
                COUNT(DISTINCT analysis_id) AS lotes
            FROM v_defects_by_lot
            WHERE analysis_date BETWEEN :start AND :end
              AND avg_percentage IS NOT NULL
              AND avg_percentage > 0
            GROUP BY defect_name, defect_category
            ORDER BY avg_pct DESC
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit},
    ).mappings().all()

    return [
        {
            "defect": r["defect_name"],
            "category": r["defect_category"],
            "avg_pct": float(r["avg_pct"] or 0),
            "lots": r["lotes"],
        }
        for r in rows
    ]


# ──────────────────────────────────────────────────────────────────
# HISTOGRAMAS
# ──────────────────────────────────────────────────────────────────

@router.get("/histogram/by-classification")
def histogram_by_classification(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    product_type: str | None = Query(None, pattern="^(ENTERO|COLA)?$"),
    supplier: str | None = Query(None),
):
    """Distribución de lotes por clasificación de talla.

    Como aquí no tenemos los R-CC-034 individuales en el histórico, lo que
    devolvemos es la distribución por `average_classification_code` — es decir,
    cuántos lotes (y cuántas libras) cayeron en cada rango.
    """
    start, end = _default_range(start_date, end_date)

    where = ["qa.analysis_date BETWEEN :start AND :end",
             "qa.average_classification_code IS NOT NULL"]
    params: dict = {"start": start, "end": end}
    if product_type:
        where.append("l.product_type = :product_type")
        params["product_type"] = product_type
    if supplier:
        where.append("s.supplier_name ILIKE :supplier")
        params["supplier"] = f"%{supplier}%"

    where_sql = " AND ".join(where)

    rows = db.execute(
        text(
            f"""
            SELECT
                qa.average_classification_code AS classification,
                COUNT(*) AS lots,
                COALESCE(SUM(rl.received_lbs), 0) AS total_lbs
            FROM quality_analyses qa
            JOIN analysis_lots al ON qa.analysis_id = al.analysis_id
            JOIN lots l           ON al.lot_id = l.lot_id
            LEFT JOIN suppliers s ON l.supplier_id = s.supplier_id
            LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
            WHERE {where_sql}
            GROUP BY qa.average_classification_code
            ORDER BY qa.average_classification_code
            """  # noqa: S608
        ),
        params,
    ).mappings().all()

    total_lots = sum(r["lots"] for r in rows)
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "filters": {"product_type": product_type, "supplier": supplier},
        "total_lots": total_lots,
        "buckets": [
            {
                "classification": r["classification"],
                "lots": r["lots"],
                "total_lbs": float(r["total_lbs"] or 0),
                "pct": round((r["lots"] / total_lots) * 100, 1) if total_lots else 0,
            }
            for r in rows
        ],
    }


@router.get("/histogram/grammage-trend")
def histogram_grammage_trend(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    """Evolución del gramaje promedio por mes."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                DATE_TRUNC('month', qa.analysis_date)::date AS month,
                ROUND(AVG(qa.average_grammage)::numeric, 2) AS avg_grammage,
                COUNT(*) AS lots
            FROM quality_analyses qa
            WHERE qa.analysis_date BETWEEN :start AND :end
              AND qa.average_grammage IS NOT NULL
            GROUP BY 1
            ORDER BY 1
            """
        ),
        {"start": start, "end": end},
    ).mappings().all()

    return [
        {
            "month": r["month"].isoformat() if r["month"] else None,
            "avg_grammage": float(r["avg_grammage"] or 0),
            "lots": r["lots"],
        }
        for r in rows
    ]
