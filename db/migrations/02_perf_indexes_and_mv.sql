-- =============================================================================
-- Migración 02 — Rendimiento: índices que faltan + vistas materializadas
-- =============================================================================
-- Aplicable de forma idempotente con `IF NOT EXISTS`. Aplicarla una vez en
-- producción y refrescar las MV con `SELECT refresh_all_reports();` o el
-- endpoint POST /api/admin/refresh-reports.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ÍNDICES EN FKs Y COLUMNAS USADAS EN WHERE/JOIN/ORDER BY
-- (PostgreSQL no crea índices automáticos para FKs salvo que sean parte del PK)
-- ─────────────────────────────────────────────────────────────────────────────

-- FKs sin índice → JOINs lentos
CREATE INDEX IF NOT EXISTS idx_analysis_lots_lot          ON analysis_lots(lot_id);
CREATE INDEX IF NOT EXISTS idx_analysis_lots_analysis     ON analysis_lots(analysis_id);
CREATE INDEX IF NOT EXISTS idx_reception_lots_lot         ON reception_lots(lot_id);
CREATE INDEX IF NOT EXISTS idx_reception_lots_reception   ON reception_lots(reception_id);
CREATE INDEX IF NOT EXISTS idx_lot_treaters_lot           ON lot_treaters(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_treaters_treater       ON lot_treaters(treater_id);
CREATE INDEX IF NOT EXISTS idx_sampling_defects_sampling  ON sampling_defects(sampling_id);
CREATE INDEX IF NOT EXISTS idx_sampling_defects_defect    ON sampling_defects(defect_id);
CREATE INDEX IF NOT EXISTS idx_analysis_samplings_analysis ON analysis_samplings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_flavors_analysis  ON analysis_flavors(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_odors_analysis    ON analysis_odors(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_colors_analysis   ON analysis_colors(analysis_id);
CREATE INDEX IF NOT EXISTS idx_attachments_analysis       ON attachments(analysis_id);
CREATE INDEX IF NOT EXISTS idx_attachments_reception      ON attachments(reception_id);

-- Compuestos para filtros comunes del dashboard
CREATE INDEX IF NOT EXISTS idx_qa_date_decision     ON quality_analyses(analysis_date DESC, decision_id);
CREATE INDEX IF NOT EXISTS idx_qa_status_date       ON quality_analyses(status, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_lots_supplier_year   ON lots(supplier_id, lot_year);
CREATE INDEX IF NOT EXISTS idx_receptions_date_plant ON receptions(reception_date DESC, plant_id);
CREATE INDEX IF NOT EXISTS idx_qa_global_defect_pct ON quality_analyses(global_defect_percentage)
    WHERE global_defect_percentage IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VISTAS MATERIALIZADAS (pre-agregadas — refresco diario o on-demand)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── mv_dashboard_daily: 1 fila por día con todo lo que el dashboard pinta ────

DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_daily CASCADE;
CREATE MATERIALIZED VIEW mv_dashboard_daily AS
SELECT
    r.reception_date                                                AS date,
    COUNT(DISTINCT l.lot_id)                                        AS total_lots,
    COUNT(DISTINCT l.lot_id) FILTER (WHERE d.is_approval)           AS aceptados,
    COUNT(DISTINCT l.lot_id) FILTER (WHERE d.is_rejection)          AS rechazados,
    COUNT(DISTINCT l.lot_id) FILTER (WHERE d.requires_action)       AS reproceso,
    COUNT(DISTINCT l.lot_id) FILTER (WHERE qa.decision_id IS NULL)  AS sin_decision,
    SUM(rl.received_lbs)                                            AS total_lbs,
    ROUND(AVG(qa.global_defect_percentage)::numeric, 2)             AS avg_defect_pct,
    ROUND(AVG(qa.so2_global)::numeric, 2)                           AS avg_so2
FROM lots l
JOIN reception_lots rl    ON l.lot_id = rl.lot_id
JOIN receptions     r     ON rl.reception_id = r.reception_id
LEFT JOIN analysis_lots al ON l.lot_id = al.lot_id
LEFT JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
LEFT JOIN decisions d     ON qa.decision_id = d.decision_id
GROUP BY r.reception_date;

CREATE UNIQUE INDEX idx_mv_dashboard_daily_date ON mv_dashboard_daily(date);

-- ── mv_supplier_kpis: KPIs por proveedor por mes ─────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_supplier_kpis CASCADE;
CREATE MATERIALIZED VIEW mv_supplier_kpis AS
SELECT
    s.supplier_id,
    s.supplier_name,
    DATE_TRUNC('month', qa.analysis_date)::date  AS month,
    COUNT(DISTINCT l.lot_id)                     AS lots_count,
    SUM(rl.received_lbs)                         AS total_lbs,
    ROUND(AVG(qa.global_defect_percentage)::numeric, 2) AS avg_defect_pct,
    ROUND(AVG(qa.so2_global)::numeric, 2)        AS avg_so2,
    COUNT(*) FILTER (WHERE d.is_rejection)       AS rejected_lots,
    COUNT(*) FILTER (WHERE d.is_approval)        AS approved_lots
FROM suppliers s
JOIN lots l ON s.supplier_id = l.supplier_id
LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
LEFT JOIN analysis_lots al ON l.lot_id = al.lot_id
LEFT JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
LEFT JOIN decisions d ON qa.decision_id = d.decision_id
WHERE qa.analysis_date IS NOT NULL
GROUP BY s.supplier_id, s.supplier_name, DATE_TRUNC('month', qa.analysis_date);

CREATE UNIQUE INDEX idx_mv_supplier_kpis ON mv_supplier_kpis(supplier_id, month);
CREATE INDEX idx_mv_supplier_kpis_month ON mv_supplier_kpis(month DESC);
CREATE INDEX idx_mv_supplier_kpis_defects ON mv_supplier_kpis(avg_defect_pct DESC);

-- ── mv_defects_aggregated: % promedio de cada defecto por día ────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_defects_aggregated CASCADE;
CREATE MATERIALIZED VIEW mv_defects_aggregated AS
SELECT
    qa.analysis_date                            AS date,
    d.defect_id,
    d.defect_name,
    d.defect_category,
    ROUND(AVG(sd.percentage)::numeric, 2)       AS avg_pct,
    COUNT(DISTINCT qa.analysis_id)              AS lots_with_defect
FROM sampling_defects sd
JOIN analysis_samplings asg ON sd.sampling_id = asg.sampling_id
JOIN quality_analyses qa     ON asg.analysis_id = qa.analysis_id
JOIN defects d              ON sd.defect_id = d.defect_id
WHERE sd.percentage IS NOT NULL AND sd.percentage > 0
GROUP BY qa.analysis_date, d.defect_id, d.defect_name, d.defect_category;

CREATE UNIQUE INDEX idx_mv_defects_aggregated ON mv_defects_aggregated(date, defect_id);
CREATE INDEX idx_mv_defects_aggregated_date ON mv_defects_aggregated(date DESC);

-- ── mv_worst_lots: para tabla "Lotes con mayor % defectos" del dashboard ─────

DROP MATERIALIZED VIEW IF EXISTS mv_worst_lots CASCADE;
CREATE MATERIALIZED VIEW mv_worst_lots AS
SELECT
    l.lot_id,
    qa.analysis_id,
    l.lot_code,
    l.lot_year,
    qa.analysis_date,
    MIN(r.reception_date)                       AS reception_date,
    s.supplier_name,
    l.product_type,
    SUM(rl.received_lbs)                        AS total_lbs,
    qa.global_defect_percentage                 AS pct_defects,
    qa.so2_global,
    d.decision_name                             AS decision,
    CASE
        WHEN qa.global_defect_percentage >= 50 THEN 'critico'
        WHEN qa.global_defect_percentage >= 40 THEN 'alto'
        WHEN qa.global_defect_percentage >= 30 THEN 'medio'
        ELSE 'normal'
    END                                          AS severity
FROM quality_analyses qa
JOIN analysis_lots al ON qa.analysis_id = al.analysis_id
JOIN lots l           ON al.lot_id = l.lot_id
LEFT JOIN suppliers s ON l.supplier_id = s.supplier_id
LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
LEFT JOIN receptions     r  ON rl.reception_id = r.reception_id
LEFT JOIN decisions d ON qa.decision_id = d.decision_id
WHERE qa.global_defect_percentage IS NOT NULL
GROUP BY l.lot_id, qa.analysis_id, l.lot_code, l.lot_year, qa.analysis_date,
         s.supplier_name, l.product_type, qa.global_defect_percentage,
         qa.so2_global, d.decision_name;

CREATE UNIQUE INDEX idx_mv_worst_lots_pk ON mv_worst_lots(lot_id, analysis_id);
CREATE INDEX idx_mv_worst_lots_severity ON mv_worst_lots(severity, pct_defects DESC);
CREATE INDEX idx_mv_worst_lots_date ON mv_worst_lots(analysis_date DESC, pct_defects DESC);
CREATE INDEX idx_mv_worst_lots_pct ON mv_worst_lots(pct_defects DESC);

-- ── mv_top_suppliers_volume: ranking proveedores por volumen últimos 90 días ─

DROP MATERIALIZED VIEW IF EXISTS mv_top_suppliers_volume CASCADE;
CREATE MATERIALIZED VIEW mv_top_suppliers_volume AS
SELECT
    s.supplier_id,
    s.supplier_name,
    COUNT(DISTINCT l.lot_id)        AS lots,
    SUM(rl.received_lbs)            AS total_lbs,
    ROUND(AVG(qa.global_defect_percentage)::numeric, 2) AS avg_defect_pct
FROM suppliers s
JOIN lots l            ON s.supplier_id = l.supplier_id
JOIN reception_lots rl ON l.lot_id = rl.lot_id
JOIN receptions     r  ON rl.reception_id = r.reception_id
LEFT JOIN analysis_lots al ON l.lot_id = al.lot_id
LEFT JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
WHERE r.reception_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY s.supplier_id, s.supplier_name;

CREATE UNIQUE INDEX idx_mv_top_suppliers_volume ON mv_top_suppliers_volume(supplier_id);
CREATE INDEX idx_mv_top_suppliers_volume_lbs ON mv_top_suppliers_volume(total_lbs DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUNCIÓN PARA REFRESCAR TODAS LAS MV
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_all_reports() RETURNS TEXT AS $$
DECLARE
    started TIMESTAMP := clock_timestamp();
    elapsed_ms INT;
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_supplier_kpis;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_defects_aggregated;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_worst_lots;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_suppliers_volume;
    elapsed_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - started))::int;
    RETURN format('All MV refreshed in %s ms', elapsed_ms);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. POBLADO INICIAL
-- ─────────────────────────────────────────────────────────────────────────────

-- Las MVs se crean ya con los datos del SELECT, no hace falta REFRESH inicial.
-- Pero conviene actualizar estadísticas para que el planner las use bien:

ANALYZE quality_analyses;
ANALYZE lots;
ANALYZE reception_lots;
ANALYZE analysis_lots;
ANALYZE sampling_defects;
ANALYZE analysis_samplings;
ANALYZE mv_dashboard_daily;
ANALYZE mv_supplier_kpis;
ANALYZE mv_defects_aggregated;
ANALYZE mv_worst_lots;
ANALYZE mv_top_suppliers_volume;
