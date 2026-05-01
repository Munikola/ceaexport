"""Endpoints de reportes — todos sobre vistas materializadas (mv_*).

Las consultas leen de las MVs, que son refrescadas:
- Manualmente desde POST /api/admin/refresh-reports
- O automáticamente vía cron / al cerrar un análisis

Esto permite que el dashboard cargue con queries simples (escaneo de tabla
con índice) en vez de recalcular JOINs cada vez.
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
    today = date.today()
    if not end:
        end = today
    if not start:
        start = end - timedelta(days=30)
    return start, end


# ──────────────────────────────────────────────────────────────────
# DASHBOARD — sobre mv_dashboard_daily / mv_supplier_kpis / etc.
# ──────────────────────────────────────────────────────────────────

@router.get("/dashboard/kpis")
def dashboard_kpis(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
) -> dict:
    """KPIs grandes para las cards del dashboard. Lee de mv_dashboard_daily."""
    start, end = _default_range(start_date, end_date)

    row = db.execute(
        text(
            """
            SELECT
                COALESCE(SUM(total_lots), 0)                         AS total_lots,
                COALESCE(SUM(total_lbs), 0)                          AS total_lbs,
                ROUND(AVG(avg_defect_pct)::numeric, 1)               AS avg_defect_pct,
                ROUND(AVG(avg_so2)::numeric, 1)                      AS avg_so2,
                COALESCE(SUM(aceptados), 0)                          AS aceptados,
                COALESCE(SUM(rechazados), 0)                         AS rechazados,
                COALESCE(SUM(reproceso), 0)                          AS reproceso,
                COALESCE(SUM(sin_decision), 0)                       AS sin_decision
            FROM mv_dashboard_daily
            WHERE date BETWEEN :start AND :end
            """
        ),
        {"start": start, "end": end},
    ).mappings().first()

    total = row["total_lots"] or 0
    rejected = row["rechazados"] or 0
    accepted = row["aceptados"] or 0
    rejected_pct = round((rejected / total) * 100, 1) if total else 0
    accepted_pct = round((accepted / total) * 100, 1) if total else 0

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "total_lots": total,
        "total_lbs": float(row["total_lbs"] or 0),
        "avg_defect_pct": float(row["avg_defect_pct"] or 0),
        "avg_so2": float(row["avg_so2"] or 0),
        "rejected_lots": rejected,
        "accepted_lots": accepted,
        "reproceso_lots": row["reproceso"] or 0,
        "sin_decision_lots": row["sin_decision"] or 0,
        "rejected_pct": rejected_pct,
        "accepted_pct": accepted_pct,
    }


@router.get("/dashboard/lots-per-day")
def dashboard_lots_per_day(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    """Serie temporal con barras apiladas por decisión + % defectos diario.

    El frontend calcula la media móvil 7 días desde estos datos.
    """
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                date,
                total_lots                  AS total,
                aceptados,
                rechazados,
                reproceso,
                sin_decision,
                avg_defect_pct,
                avg_so2,
                total_lbs
            FROM mv_dashboard_daily
            WHERE date BETWEEN :start AND :end
            ORDER BY date
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
            "avg_defect_pct": float(r["avg_defect_pct"] or 0),
            "avg_so2": float(r["avg_so2"] or 0),
            "total_lbs": float(r["total_lbs"] or 0),
        }
        for r in rows
    ]


@router.get("/dashboard/top-suppliers-by-volume")
def dashboard_top_suppliers_by_volume(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(10, ge=1, le=50),
):
    """Lee de mv_top_suppliers_volume (últimos 90 días)."""
    rows = db.execute(
        text(
            """
            SELECT supplier_name, total_lbs, lots, avg_defect_pct
            FROM mv_top_suppliers_volume
            WHERE supplier_name IS NOT NULL
            ORDER BY total_lbs DESC NULLS LAST
            LIMIT :limit
            """
        ),
        {"limit": limit},
    ).mappings().all()

    return [
        {
            "supplier": r["supplier_name"],
            "total_lbs": float(r["total_lbs"] or 0),
            "lots": r["lots"],
            "avg_defect_pct": float(r["avg_defect_pct"] or 0),
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
    """KPI de proveedor agregando varios meses dentro del rango. Usa mv_supplier_kpis."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                supplier_name,
                ROUND(AVG(avg_defect_pct)::numeric, 1) AS avg_defect_pct,
                SUM(lots_count)::int                   AS lots,
                SUM(total_lbs)                         AS total_lbs
            FROM mv_supplier_kpis
            WHERE month BETWEEN DATE_TRUNC('month', :start::date)::date AND :end
              AND supplier_name IS NOT NULL
              AND avg_defect_pct IS NOT NULL
            GROUP BY supplier_name
            HAVING SUM(lots_count) >= :min_lots
            ORDER BY avg_defect_pct DESC NULLS LAST
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit, "min_lots": min_lots},
    ).mappings().all()

    return [
        {
            "supplier": r["supplier_name"],
            "avg_defect_pct": float(r["avg_defect_pct"] or 0),
            "lots": r["lots"],
            "total_lbs": float(r["total_lbs"] or 0),
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
    """Defectos más frecuentes (% promedio) usando mv_defects_aggregated."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                defect_name,
                defect_category,
                ROUND(AVG(avg_pct)::numeric, 1)            AS avg_pct,
                SUM(lots_with_defect)::int                 AS lots
            FROM mv_defects_aggregated
            WHERE date BETWEEN :start AND :end
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
            "lots": r["lots"],
        }
        for r in rows
    ]


@router.get("/dashboard/worst-lots")
def dashboard_worst_lots(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Lotes con peor % defectos en el periodo (lee de mv_worst_lots)."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                lot_id,
                analysis_id,
                lot_code,
                lot_year,
                analysis_date,
                reception_date,
                supplier_name,
                product_type,
                total_lbs,
                pct_defects,
                so2_global,
                decision,
                severity
            FROM mv_worst_lots
            WHERE analysis_date BETWEEN :start AND :end
            ORDER BY pct_defects DESC
            LIMIT :limit
            """
        ),
        {"start": start, "end": end, "limit": limit},
    ).mappings().all()

    return [
        {
            "lot_id": r["lot_id"],
            "analysis_id": r["analysis_id"],
            "lot_code": r["lot_code"],
            "lot_year": r["lot_year"],
            "analysis_date": r["analysis_date"].isoformat() if r["analysis_date"] else None,
            "reception_date": r["reception_date"].isoformat() if r["reception_date"] else None,
            "supplier_name": r["supplier_name"],
            "product_type": r["product_type"],
            "total_lbs": float(r["total_lbs"] or 0),
            "pct_defects": float(r["pct_defects"] or 0),
            "so2_global": float(r["so2_global"] or 0),
            "decision": r["decision"],
            "severity": r["severity"],
        }
        for r in rows
    ]


def _compare(value: float, op: str, threshold: float) -> bool:
    if value is None or threshold is None:
        return False
    return {
        ">": value > threshold,
        ">=": value >= threshold,
        "<": value < threshold,
        "<=": value <= threshold,
        "=": value == threshold,
    }.get(op, False)


@router.get("/dashboard/operational-alerts")
def dashboard_operational_alerts(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
):
    """Alertas operativas evaluadas dinámicamente desde quality_rules.

    Cada regla activa se evalúa contra las MVs según su `metric` y dispara
    alerta(s) si su condición se cumple. Las reglas se gestionan desde
    /api/quality-rules (admin).
    """
    start, end = _default_range(start_date, end_date)
    rules = db.execute(
        text(
            """
            SELECT rule_id, rule_name, metric, operator, threshold_value,
                   severity, action_message
            FROM quality_rules
            WHERE active IS TRUE
            ORDER BY
                CASE severity WHEN 'critical' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,
                rule_id
            """
        )
    ).mappings().all()

    alerts: list[dict] = []
    sev_order = {"critical": 0, "warn": 1, "info": 2, None: 3}

    for r in rules:
        metric = r["metric"]
        op = r["operator"]
        threshold = float(r["threshold_value"]) if r["threshold_value"] is not None else None
        severity = r["severity"]
        rule_name = r["rule_name"]

        if metric == "global_defect_percentage":
            # Lotes individuales con % defects que cumplen la condición
            row = db.execute(
                text(
                    f"""
                    SELECT lot_code, lot_year, supplier_name, pct_defects
                    FROM mv_worst_lots
                    WHERE analysis_date BETWEEN :start AND :end
                      AND pct_defects {op} :t
                    ORDER BY pct_defects DESC
                    LIMIT 5
                    """  # noqa: S608
                ),
                {"start": start, "end": end, "t": threshold},
            ).mappings().all()
            for lot in row:
                alerts.append({
                    "kind": "lot",
                    "title": f"Lote {lot['lot_code']}",
                    "detail": f"{lot['supplier_name'] or '—'} · {lot['pct_defects']}% defectos",
                    "severity": severity,
                    "rule": rule_name,
                })

        elif metric == "supplier_avg_defect_pct":
            row = db.execute(
                text(
                    f"""
                    SELECT supplier_name,
                           ROUND(AVG(avg_defect_pct)::numeric, 1) AS pct,
                           SUM(lots_count)::int AS lots
                    FROM mv_supplier_kpis
                    WHERE month BETWEEN DATE_TRUNC('month', :start::date)::date AND :end
                      AND supplier_name IS NOT NULL
                    GROUP BY supplier_name
                    HAVING AVG(avg_defect_pct) {op} :t AND SUM(lots_count) >= 3
                    ORDER BY pct DESC
                    LIMIT 5
                    """  # noqa: S608
                ),
                {"start": start, "end": end, "t": threshold},
            ).mappings().all()
            for s in row:
                alerts.append({
                    "kind": "supplier",
                    "title": s["supplier_name"],
                    "detail": f"% defectos prom. {s['pct']}% en {s['lots']} lotes",
                    "severity": severity,
                    "rule": rule_name,
                })

        elif metric == "avg_so2_period":
            row = db.execute(
                text(
                    """
                    SELECT ROUND(AVG(avg_so2)::numeric, 1) AS v
                    FROM mv_dashboard_daily
                    WHERE date BETWEEN :start AND :end AND avg_so2 IS NOT NULL
                    """
                ),
                {"start": start, "end": end},
            ).mappings().first()
            if row and row["v"] is not None and _compare(float(row["v"]), op, threshold or 0):
                alerts.append({
                    "kind": "metric",
                    "title": "SO₂ promedio",
                    "detail": f"{row['v']} ppm ({op} {threshold})",
                    "severity": severity,
                    "rule": rule_name,
                })

        elif metric == "avg_defect_pct_period":
            row = db.execute(
                text(
                    """
                    SELECT ROUND(AVG(avg_defect_pct)::numeric, 1) AS v
                    FROM mv_dashboard_daily
                    WHERE date BETWEEN :start AND :end AND avg_defect_pct IS NOT NULL
                    """
                ),
                {"start": start, "end": end},
            ).mappings().first()
            if row and row["v"] is not None and _compare(float(row["v"]), op, threshold or 0):
                alerts.append({
                    "kind": "metric",
                    "title": "% defectos promedio",
                    "detail": f"{row['v']}% ({op} {threshold}%)",
                    "severity": severity,
                    "rule": rule_name,
                })

        elif metric == "defect_pct":
            # Buscar defectos cuyo % promedio cumpla la condición
            row = db.execute(
                text(
                    f"""
                    SELECT defect_name, ROUND(AVG(avg_pct)::numeric, 1) AS pct
                    FROM mv_defects_aggregated
                    WHERE date BETWEEN :start AND :end
                    GROUP BY defect_name
                    HAVING AVG(avg_pct) {op} :t
                    ORDER BY pct DESC
                    LIMIT 5
                    """  # noqa: S608
                ),
                {"start": start, "end": end, "t": threshold},
            ).mappings().all()
            for d in row:
                alerts.append({
                    "kind": "defect",
                    "title": d["defect_name"],
                    "detail": f"{d['pct']}% promedio en el periodo",
                    "severity": severity,
                    "rule": rule_name,
                })

        elif metric == "rejected_pct":
            row = db.execute(
                text(
                    """
                    SELECT
                        ROUND(
                            100.0 * COALESCE(SUM(rechazados), 0) /
                            NULLIF(SUM(total_lots), 0)::numeric, 1
                        ) AS v
                    FROM mv_dashboard_daily
                    WHERE date BETWEEN :start AND :end
                    """
                ),
                {"start": start, "end": end},
            ).mappings().first()
            if row and row["v"] is not None and _compare(float(row["v"]), op, threshold or 0):
                alerts.append({
                    "kind": "metric",
                    "title": "% rechazos del periodo",
                    "detail": f"{row['v']}% ({op} {threshold}%)",
                    "severity": severity,
                    "rule": rule_name,
                })
        # Otras métricas se ignoran silenciosamente (ej. so2_global, que requiere
        # query a quality_analyses; se puede añadir si hace falta).

    alerts.sort(key=lambda a: sev_order.get(a["severity"], 99))
    return alerts[:limit]


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

    Como el histórico no rellena `average_classification_code`, clasifica
    dinámicamente desde c_kg (cabeza) o c_kg2 (cola) cruzando con la tabla
    `cc_classifications` / `sc_classifications`.
    """
    start, end = _default_range(start_date, end_date)
    is_cola = product_type == "COLA"
    cls_table = "sc_classifications" if is_cola else "cc_classifications"
    cls_col = "c_kg2" if is_cola else "c_kg"

    where = [
        "qa.analysis_date BETWEEN :start AND :end",
        f"qa.{cls_col} IS NOT NULL",
    ]
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
                cls.range_code AS classification,
                cls.sort_order  AS sort_order,
                COUNT(*)        AS lots,
                COALESCE(SUM(rl.received_lbs), 0) AS total_lbs
            FROM quality_analyses qa
            JOIN analysis_lots al ON qa.analysis_id = al.analysis_id
            JOIN lots l           ON al.lot_id = l.lot_id
            LEFT JOIN suppliers s ON l.supplier_id = s.supplier_id
            LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
            JOIN {cls_table} cls
              ON qa.{cls_col} >= cls.min_count
             AND qa.{cls_col} <  cls.max_count
            WHERE {where_sql}
            GROUP BY cls.range_code, cls.sort_order
            ORDER BY cls.sort_order
            """  # noqa: S608
        ),
        params,
    ).mappings().all()

    total_lots = sum(r["lots"] for r in rows)
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "filters": {"product_type": product_type, "supplier": supplier},
        "classification_type": "SC" if is_cola else "CC",
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
    """Evolución del gramaje promedio por mes (deriva de c_kg si falta avg_grammage)."""
    start, end = _default_range(start_date, end_date)

    rows = db.execute(
        text(
            """
            SELECT
                DATE_TRUNC('month', qa.analysis_date)::date AS month,
                ROUND(
                    AVG(COALESCE(qa.average_grammage, 1000.0 / NULLIF(qa.c_kg, 0)))::numeric,
                    2
                ) AS avg_grammage,
                COUNT(*) AS lots
            FROM quality_analyses qa
            WHERE qa.analysis_date BETWEEN :start AND :end
              AND (qa.average_grammage IS NOT NULL OR qa.c_kg IS NOT NULL)
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


# ──────────────────────────────────────────────────────────────────
# REFRESH (admin only)
# ──────────────────────────────────────────────────────────────────

@router.post("/admin/refresh-reports", status_code=200)
def refresh_reports(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Refresca todas las vistas materializadas. Solo admin."""
    from fastapi import HTTPException
    if not user.role or user.role.role_code != "admin":
        raise HTTPException(403, "Solo admin puede refrescar reportes")
    msg = db.execute(text("SELECT refresh_all_reports()")).scalar()
    db.commit()
    return {"status": "ok", "detail": msg}
