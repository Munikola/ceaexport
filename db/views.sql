-- =============================================================================
-- CEA EXPORT — Vistas para reportes y BI
-- =============================================================================
-- Sustituyen al Excel manual "LOTES RECIBIDOS Y DETERMINACIÓN DE SULFITOS".
-- Toda salida tabular sale de aquí; nadie edita un Excel a mano.
-- =============================================================================

-- =============================================================================
-- v_lotes_recibidos
-- Replica el Excel actual columna por columna.
-- 1 fila por lote (aunque el lote haya llegado en N camiones — caso 1233).
-- =============================================================================
CREATE OR REPLACE VIEW v_lotes_recibidos AS
WITH lot_aggregates AS (
    SELECT
        rl.lot_id,
        SUM(rl.received_lbs)                         AS total_lbs,
        SUM(rl.boxes_count)                          AS total_kavetas,
        SUM(rl.bins_count)                           AS total_bines,
        MIN(r.reception_date)                        AS first_reception_date,
        MIN(r.arrival_time)                          AS first_arrival_time,
        STRING_AGG(DISTINCT lc.company_name, ' / ')  AS logistica
    FROM reception_lots rl
    JOIN receptions r        ON rl.reception_id = r.reception_id
    LEFT JOIN logistics_companies lc ON r.logistics_company_id = lc.logistics_company_id
    GROUP BY rl.lot_id
),
lot_treaters_text AS (
    SELECT
        lt.lot_id,
        STRING_AGG(t.full_name, ' Y ' ORDER BY t.full_name) AS tratador
    FROM lot_treaters lt
    JOIN treaters t ON lt.treater_id = t.treater_id
    GROUP BY lt.lot_id
),
flavor_text AS (
    -- Compone "70% TIERRA LEVE - 30% TIERRA MODERADA" desde analysis_flavors.
    SELECT
        af.analysis_id,
        STRING_AGG(
            CASE
                WHEN f.is_default OR af.percentage IS NULL
                    THEN UPPER(f.flavor_name)
                ELSE
                    af.percentage::text || '% ' ||
                    UPPER(f.flavor_name) ||
                    COALESCE(' ' || UPPER(i.intensity_name), '')
            END,
            ' - '
            ORDER BY af.percentage DESC NULLS LAST
        ) AS sabor
    FROM analysis_flavors af
    JOIN flavors f         ON af.flavor_id = f.flavor_id
    LEFT JOIN intensities i ON af.intensity_id = i.intensity_id
    WHERE af.sample_state = 'cocido'
    GROUP BY af.analysis_id
),
analysis_per_lot AS (
    -- 1 análisis "más reciente" por lote (en multi-entrega es el agregado).
    SELECT DISTINCT ON (al.lot_id)
        al.lot_id,
        qa.*
    FROM analysis_lots al
    JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
    ORDER BY al.lot_id, qa.analysis_date DESC, qa.analysis_time DESC
)
SELECT
    apl.shift                              AS turno,
    p.plant_name                           AS planta,
    apl.analysis_time                      AS hora_analisis,
    la.first_reception_date                AS fecha_recepcion,
    l.lot_code                             AS lote,
    l.lot_year                             AS lote_anio,
    s.supplier_name                        AS proveedor,
    o.origin_name                          AS procedencia,
    pn.pond_code                           AS psc,
    l.product_type                         AS tipo_producto,
    la.total_lbs                           AS lbs_recibidas,
    apl.gr_cc,
    apl.c_kg,
    apl.gr_sc,
    apl.c_kg2,
    c.color_name                           AS color,
    ft.sabor,
    ltt.tratador,
    ch.chemical_name                       AS metabisulfito,
    apl.so2_global,
    la.logistica,
    apl.global_defect_percentage           AS pct_defectos_global,
    apl.general_observations               AS observacion,
    -- decisión derivada (separada de la observación, según diseño)
    d.decision_name                        AS decision,
    apl.destined_product_type              AS producto_para,
    apl.status                             AS estado_analisis
FROM lots l
LEFT JOIN lot_aggregates       la  ON l.lot_id = la.lot_id
LEFT JOIN lot_treaters_text    ltt ON l.lot_id = ltt.lot_id
LEFT JOIN suppliers            s   ON l.supplier_id = s.supplier_id
LEFT JOIN origins              o   ON l.origin_id = o.origin_id
LEFT JOIN ponds                pn  ON l.pond_id = pn.pond_id
LEFT JOIN chemicals            ch  ON l.chemical_id = ch.chemical_id
LEFT JOIN analysis_per_lot     apl ON l.lot_id = apl.lot_id
LEFT JOIN plants               p   ON apl.plant_id = p.plant_id
LEFT JOIN flavor_text          ft  ON apl.analysis_id = ft.analysis_id
LEFT JOIN analysis_colors      ac  ON apl.analysis_id = ac.analysis_id AND ac.sample_state = 'cocido'
LEFT JOIN colors               c   ON ac.color_id = c.color_id
LEFT JOIN decisions            d   ON apl.decision_id = d.decision_id
ORDER BY la.first_reception_date DESC, apl.analysis_time DESC;

-- =============================================================================
-- v_defects_by_lot
-- Pivote de defectos: una fila por (lote, defecto) con % promedio entre muestreos.
-- =============================================================================
CREATE OR REPLACE VIEW v_defects_by_lot AS
SELECT
    qa.analysis_id,
    l.lot_id,
    l.lot_code,
    l.lot_year,
    qa.analysis_date,
    s.supplier_name,
    pn.pond_code             AS psc,
    d.defect_code,
    d.defect_name,
    d.defect_category,
    AVG(sd.percentage)       AS avg_percentage,
    SUM(sd.units_count)      AS total_units,
    COUNT(DISTINCT asg.sampling_id) AS samplings_with_defect
FROM quality_analyses qa
JOIN analysis_lots        al  ON qa.analysis_id = al.analysis_id
JOIN lots                 l   ON al.lot_id = l.lot_id
LEFT JOIN suppliers       s   ON l.supplier_id = s.supplier_id
LEFT JOIN ponds           pn  ON l.pond_id = pn.pond_id
JOIN analysis_samplings   asg ON qa.analysis_id = asg.analysis_id
JOIN sampling_defects     sd  ON asg.sampling_id = sd.sampling_id
JOIN defects              d   ON sd.defect_id = d.defect_id
GROUP BY qa.analysis_id, l.lot_id, l.lot_code, l.lot_year, qa.analysis_date,
         s.supplier_name, pn.pond_code, d.defect_code, d.defect_name, d.defect_category;

-- =============================================================================
-- v_flavors_by_lot
-- Sabores por lote (crudo y cocido por separado).
-- =============================================================================
CREATE OR REPLACE VIEW v_flavors_by_lot AS
SELECT
    qa.analysis_id,
    l.lot_id,
    l.lot_code,
    l.lot_year,
    qa.analysis_date,
    s.supplier_name,
    af.sample_state,
    f.flavor_name,
    i.intensity_name,
    af.percentage
FROM analysis_flavors  af
JOIN quality_analyses  qa  ON af.analysis_id = qa.analysis_id
JOIN analysis_lots     al  ON qa.analysis_id = al.analysis_id
JOIN lots              l   ON al.lot_id = l.lot_id
LEFT JOIN suppliers    s   ON l.supplier_id = s.supplier_id
JOIN flavors           f   ON af.flavor_id = f.flavor_id
LEFT JOIN intensities  i   ON af.intensity_id = i.intensity_id;

-- =============================================================================
-- v_supplier_performance
-- KPIs por proveedor por mes: lotes, libras totales, defecto promedio,
-- SO₂ promedio, lotes rechazados.
-- =============================================================================
CREATE OR REPLACE VIEW v_supplier_performance AS
SELECT
    s.supplier_id,
    s.supplier_name,
    DATE_TRUNC('month', qa.analysis_date)::date AS month,
    COUNT(DISTINCT l.lot_id)                    AS lots_count,
    SUM(rl.received_lbs)                        AS total_lbs,
    AVG(qa.global_defect_percentage)            AS avg_defect_pct,
    AVG(qa.so2_global)                          AS avg_so2,
    SUM(CASE WHEN d.is_rejection THEN 1 ELSE 0 END) AS rejected_lots,
    SUM(CASE WHEN d.is_approval  THEN 1 ELSE 0 END) AS approved_lots
FROM lots l
JOIN suppliers          s   ON l.supplier_id = s.supplier_id
LEFT JOIN reception_lots rl ON l.lot_id = rl.lot_id
LEFT JOIN analysis_lots al  ON l.lot_id = al.lot_id
LEFT JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
LEFT JOIN decisions     d   ON qa.decision_id = d.decision_id
WHERE qa.analysis_date IS NOT NULL
GROUP BY s.supplier_id, s.supplier_name, DATE_TRUNC('month', qa.analysis_date);

-- =============================================================================
-- v_pending_analyses
-- Bandeja de análisis pendientes (Pantalla 4 del flujo).
-- =============================================================================
CREATE OR REPLACE VIEW v_pending_analyses AS
SELECT
    l.lot_id,
    l.lot_code,
    l.lot_year,
    s.supplier_name,
    o.origin_name,
    pn.pond_code              AS psc,
    l.product_type,
    SUM(rl.received_lbs)      AS total_lbs,
    MIN(r.reception_date)     AS reception_date,
    MIN(r.arrival_time)       AS arrival_time,
    p.plant_name              AS planta,
    p.plant_id,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(r.created_at))) / 3600 AS hours_since_reception
FROM lots l
JOIN reception_lots         rl ON l.lot_id = rl.lot_id
JOIN receptions             r  ON rl.reception_id = r.reception_id
LEFT JOIN suppliers         s  ON l.supplier_id = s.supplier_id
LEFT JOIN origins           o  ON l.origin_id = o.origin_id
LEFT JOIN ponds             pn ON l.pond_id = pn.pond_id
LEFT JOIN plants            p  ON r.plant_id = p.plant_id
WHERE NOT EXISTS (
    SELECT 1 FROM analysis_lots al
    JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
    WHERE al.lot_id = l.lot_id AND qa.status IN ('validado', 'rechazado')
)
GROUP BY l.lot_id, l.lot_code, l.lot_year, s.supplier_name, o.origin_name,
         pn.pond_code, l.product_type, p.plant_name, p.plant_id
ORDER BY MIN(r.reception_date), MIN(r.arrival_time);

-- =============================================================================
-- v_lot_board
-- Tablero general: TODOS los lotes con su último análisis (si existe)
-- y un estado computado (pendiente/en_analisis/liberado/rechazado).
-- =============================================================================
CREATE OR REPLACE VIEW v_lot_board AS
WITH latest_analysis AS (
    SELECT DISTINCT ON (al.lot_id)
        al.lot_id,
        qa.analysis_id,
        qa.status AS analysis_status,
        qa.analysis_date,
        qa.created_at AS analysis_created_at,
        qa.analyst_id,
        u.full_name AS analyst_name,
        d.decision_name,
        d.is_approval,
        d.is_rejection
    FROM analysis_lots al
    JOIN quality_analyses qa ON al.analysis_id = qa.analysis_id
    LEFT JOIN users u      ON qa.analyst_id = u.user_id
    LEFT JOIN decisions d  ON qa.decision_id = d.decision_id
    ORDER BY al.lot_id, qa.created_at DESC
),
attachment_counts AS (
    SELECT lot_id, COUNT(*) AS attachment_count
    FROM attachments
    GROUP BY lot_id
)
SELECT
    l.lot_id, l.lot_code, l.lot_year,
    s.supplier_name, o.origin_name, pn.pond_code AS psc,
    l.product_type,
    SUM(rl.received_lbs)  AS total_lbs,
    MIN(r.reception_date) AS reception_date,
    MIN(r.arrival_time)   AS arrival_time,
    p.plant_name AS planta, p.plant_id,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MIN(r.created_at))) / 3600 AS hours_since_reception,
    la.analysis_id, la.analysis_status, la.analysis_date,
    la.analyst_id, la.analyst_name, la.decision_name,
    COALESCE(ac.attachment_count, 0)::int AS attachment_count,
    CASE
        WHEN la.analysis_id IS NULL                            THEN 'pendiente'
        WHEN la.analysis_status IN ('borrador', 'en_revision') THEN 'en_analisis'
        WHEN la.analysis_status = 'validado'                   THEN 'liberado'
        WHEN la.analysis_status = 'rechazado'                  THEN 'rechazado'
        ELSE la.analysis_status::text
    END AS board_state
FROM lots l
JOIN reception_lots rl ON l.lot_id = rl.lot_id
JOIN receptions     r  ON rl.reception_id = r.reception_id
LEFT JOIN suppliers s  ON l.supplier_id = s.supplier_id
LEFT JOIN origins   o  ON l.origin_id   = o.origin_id
LEFT JOIN ponds     pn ON l.pond_id     = pn.pond_id
LEFT JOIN plants    p  ON r.plant_id    = p.plant_id
LEFT JOIN latest_analysis    la ON l.lot_id = la.lot_id
LEFT JOIN attachment_counts  ac ON l.lot_id = ac.lot_id
GROUP BY l.lot_id, l.lot_code, l.lot_year, s.supplier_name, o.origin_name,
         pn.pond_code, l.product_type, p.plant_name, p.plant_id,
         la.analysis_id, la.analysis_status, la.analysis_date,
         la.analyst_id, la.analyst_name, la.decision_name, ac.attachment_count;

-- =============================================================================
-- v_histogram_summary
-- Resumen del R-CC-034 por lote: distribución por clasificación CC.
-- =============================================================================
CREATE OR REPLACE VIEW v_histogram_summary AS
SELECT
    h.histogram_id,
    l.lot_id,
    l.lot_code,
    l.lot_year,
    s.supplier_name,
    h.histogram_date,
    h.total_units,
    h.total_weight_grams,
    h.average_grammage,
    h.average_classification_cc,
    h.average_classification_sc,
    cc.range_code             AS cc_range,
    SUM(he.pieces_count)      AS pieces_in_range,
    SUM(he.total_weight_grams) AS weight_in_range,
    ROUND(
        100.0 * SUM(he.pieces_count) / NULLIF(h.total_units, 0),
        2
    )                          AS pct_in_range
FROM lot_histograms       h
JOIN lots                 l  ON h.lot_id = l.lot_id
LEFT JOIN suppliers       s  ON l.supplier_id = s.supplier_id
JOIN histogram_entries    he ON h.histogram_id = he.histogram_id
JOIN cc_classifications   cc ON he.cc_classification_id = cc.cc_classification_id
GROUP BY h.histogram_id, l.lot_id, l.lot_code, l.lot_year, s.supplier_name,
         h.histogram_date, h.total_units, h.total_weight_grams, h.average_grammage,
         h.average_classification_cc, h.average_classification_sc, cc.range_code
ORDER BY h.histogram_date DESC, cc.range_code;
