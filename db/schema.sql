-- =============================================================================
-- CEA EXPORT — Control de calidad de materia prima
-- =============================================================================
-- Reemplaza R-CC-001 (Análisis Materia Prima), R-CC-034 (Histograma) y el
-- Excel "LOTES RECIBIDOS Y DETERMINACIÓN DE SULFITOS".
-- Diseñado para PostgreSQL 14+.
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE shift_type      AS ENUM ('T/D', 'T/N');
CREATE TYPE product_type    AS ENUM ('ENTERO', 'COLA');
CREATE TYPE sample_state    AS ENUM ('crudo', 'cocido');
CREATE TYPE analysis_status AS ENUM ('borrador', 'en_revision', 'validado', 'rechazado');
CREATE TYPE approval_role   AS ENUM ('analista', 'supervisor_calidad', 'jefe_calidad');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE alert_status    AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TYPE alert_severity  AS ENUM ('info', 'warn', 'critical');

-- =============================================================================
-- USUARIOS Y ROLES
-- =============================================================================

CREATE TABLE roles (
    role_id   SERIAL PRIMARY KEY,
    role_code VARCHAR(50) UNIQUE NOT NULL,
    role_name VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255),
    role_id       INT REFERENCES roles(role_id),
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CATÁLOGOS BÁSICOS
-- =============================================================================

CREATE TABLE plants (
    plant_id   SERIAL PRIMARY KEY,
    plant_code VARCHAR(50) UNIQUE NOT NULL,
    plant_name VARCHAR(100) NOT NULL,
    location   VARCHAR(150),
    active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE suppliers (
    supplier_id   SERIAL PRIMARY KEY,
    supplier_name VARCHAR(150) UNIQUE NOT NULL,
    tax_id        VARCHAR(50),
    contact_name  VARCHAR(150),
    phone         VARCHAR(50),
    email         VARCHAR(150),
    active        BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE origins (
    origin_id   SERIAL PRIMARY KEY,
    origin_name VARCHAR(150) UNIQUE NOT NULL,
    region      VARCHAR(150),
    active      BOOLEAN DEFAULT TRUE
);

-- Piscinas / PSC. Códigos alfanuméricos (I-14, P-09, R-3, 11-11).
CREATE TABLE ponds (
    pond_id     SERIAL PRIMARY KEY,
    pond_code   VARCHAR(50) NOT NULL,
    supplier_id INT REFERENCES suppliers(supplier_id),
    origin_id   INT REFERENCES origins(origin_id),
    active      BOOLEAN DEFAULT TRUE,
    UNIQUE (pond_code, supplier_id, origin_id)
);

CREATE TABLE logistics_companies (
    logistics_company_id SERIAL PRIMARY KEY,
    company_name         VARCHAR(150) UNIQUE NOT NULL,
    tax_id               VARCHAR(50),
    active               BOOLEAN DEFAULT TRUE
);

CREATE TABLE trucks (
    truck_id             SERIAL PRIMARY KEY,
    plate_number         VARCHAR(50) UNIQUE NOT NULL,
    logistics_company_id INT REFERENCES logistics_companies(logistics_company_id),
    active               BOOLEAN DEFAULT TRUE
);

CREATE TABLE drivers (
    driver_id   SERIAL PRIMARY KEY,
    full_name   VARCHAR(150) NOT NULL,
    document_id VARCHAR(50) UNIQUE,
    phone       VARCHAR(50),
    active      BOOLEAN DEFAULT TRUE
);

-- "PROVEEDOR" como entidad genérica cuando lo trató el propio proveedor.
CREATE TABLE treaters (
    treater_id    SERIAL PRIMARY KEY,
    full_name     VARCHAR(150) UNIQUE NOT NULL,
    is_proveedor  BOOLEAN DEFAULT FALSE,
    active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE chemicals (
    chemical_id   SERIAL PRIMARY KEY,
    chemical_name VARCHAR(150) UNIQUE NOT NULL,
    active        BOOLEAN DEFAULT TRUE
);

-- Comercial (default) | gerencia (lote para gerencia, lote 0707) | muestra | prueba
CREATE TABLE lot_categories (
    lot_category_id        SERIAL PRIMARY KEY,
    category_code          VARCHAR(50) UNIQUE NOT NULL,
    category_name          VARCHAR(100) NOT NULL,
    requires_full_analysis BOOLEAN DEFAULT TRUE,
    active                 BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- CATÁLOGOS ORGANOLÉPTICOS
-- =============================================================================

CREATE TABLE colors (
    color_id       SERIAL PRIMARY KEY,
    color_code     VARCHAR(50) UNIQUE NOT NULL,
    color_name     VARCHAR(100) NOT NULL,
    color_grade    VARCHAR(10),
    color_modifier VARCHAR(50),
    sort_order     INT,
    active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE flavors (
    flavor_id  SERIAL PRIMARY KEY,
    flavor_name VARCHAR(100) UNIQUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,  -- 'Característico'
    active     BOOLEAN DEFAULT TRUE
);

CREATE TABLE intensities (
    intensity_id   SERIAL PRIMARY KEY,
    intensity_code VARCHAR(50) UNIQUE NOT NULL,
    intensity_name VARCHAR(100) NOT NULL,
    sort_order     INT,
    active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE odors (
    odor_id    SERIAL PRIMARY KEY,
    odor_name  VARCHAR(100) UNIQUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    active     BOOLEAN DEFAULT TRUE
);

-- Catálogo unión: defectos del R-CC-001 (vigente 2020) + Excel viejo + práctica.
CREATE TABLE defects (
    defect_id        SERIAL PRIMARY KEY,
    defect_code      VARCHAR(50) UNIQUE NOT NULL,
    defect_name      VARCHAR(150) NOT NULL,
    defect_category  VARCHAR(50),
    in_paper_form    BOOLEAN DEFAULT FALSE,  -- aparece preimpreso en R-CC-001
    in_legacy_excel  BOOLEAN DEFAULT FALSE,  -- aparece como columna en el Excel
    active           BOOLEAN DEFAULT TRUE,
    sort_order       INT
);

CREATE TABLE decisions (
    decision_id      SERIAL PRIMARY KEY,
    decision_code    VARCHAR(50) UNIQUE NOT NULL,
    decision_name    VARCHAR(100) NOT NULL,
    is_approval      BOOLEAN DEFAULT FALSE,
    is_rejection     BOOLEAN DEFAULT FALSE,
    requires_action  BOOLEAN DEFAULT FALSE,
    sort_order       INT,
    active           BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- CATÁLOGOS HISTOGRAMA (R-CC-034)
-- =============================================================================

CREATE TABLE cc_classifications (
    cc_classification_id SERIAL PRIMARY KEY,
    range_code           VARCHAR(20) UNIQUE NOT NULL,
    min_count            INT,
    max_count            INT,
    sort_order           INT,
    active               BOOLEAN DEFAULT TRUE
);

CREATE TABLE sc_classifications (
    sc_classification_id SERIAL PRIMARY KEY,
    range_code           VARCHAR(20) UNIQUE NOT NULL,
    min_count            INT,
    max_count            INT,
    sort_order           INT,
    active               BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- CATÁLOGOS SUMINISTROS Y ATTACHMENTS
-- =============================================================================

-- BINES, KVAN (kavetas), HIELO, METABISULFITO (saco), SAL, OTROS.
-- Lo que viene en el detalle de la guía de remisión, además del camarón.
CREATE TABLE supply_types (
    supply_type_id SERIAL PRIMARY KEY,
    supply_code    VARCHAR(50) UNIQUE NOT NULL,
    supply_name    VARCHAR(100) NOT NULL,
    default_unit   VARCHAR(20),       -- 'unidades', 'sacos', 'kg'
    active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE attachment_types (
    attachment_type_id SERIAL PRIMARY KEY,
    type_code          VARCHAR(50) UNIQUE NOT NULL,
    type_name          VARCHAR(100) NOT NULL,
    active             BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- CATÁLOGO UNIFICADO DE CONDICIONES (camión, hielo, higiene)
-- =============================================================================
-- Una sola tabla, tres "tipos" de condición. La UI filtra por condition_type
-- para poblar cada dropdown. Permite añadir niveles sin migración.
CREATE TABLE condition_levels (
    condition_id    SERIAL PRIMARY KEY,
    condition_type  VARCHAR(50) NOT NULL,    -- 'truck' | 'ice' | 'hygiene'
    condition_code  VARCHAR(50) NOT NULL,
    condition_name  VARCHAR(100) NOT NULL,
    sort_order      INT,
    active          BOOLEAN DEFAULT TRUE,
    UNIQUE (condition_type, condition_code)
);

CREATE INDEX idx_condition_levels_type ON condition_levels (condition_type);

-- =============================================================================
-- LOTES
-- =============================================================================

CREATE TABLE lots (
    lot_id           SERIAL PRIMARY KEY,
    lot_code         VARCHAR(50) NOT NULL,        -- código externo, viene con el camión
    lot_year         INT NOT NULL,                -- año, para unicidad por año
    client_lot_code  VARCHAR(50),                 -- "Lote cliente" del paper, opcional
    qr_code          UUID DEFAULT gen_random_uuid(),  -- para etiquetas digitales (fase 2)
    plant_id         INT REFERENCES plants(plant_id),
    supplier_id      INT REFERENCES suppliers(supplier_id),
    origin_id        INT REFERENCES origins(origin_id),
    pond_id          INT REFERENCES ponds(pond_id),
    lot_category_id  INT REFERENCES lot_categories(lot_category_id),
    product_type     product_type,                -- ENTERO / COLA al recibir
    fishing_date     DATE,
    chemical_id      INT REFERENCES chemicals(chemical_id),
    observations     TEXT,
    created_by       INT REFERENCES users(user_id),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (lot_code, lot_year)
);

CREATE INDEX idx_lots_year     ON lots (lot_year);
CREATE INDEX idx_lots_supplier ON lots (supplier_id);
CREATE INDEX idx_lots_qr       ON lots (qr_code);

-- M:N lote ↔ tratador. Permite "TUAREZ Y MATAMOROS" o "PROVEEDOR".
CREATE TABLE lot_treaters (
    lot_id     INT REFERENCES lots(lot_id) ON DELETE CASCADE,
    treater_id INT REFERENCES treaters(treater_id),
    PRIMARY KEY (lot_id, treater_id)
);

-- =============================================================================
-- RECEPCIONES (entrega física de un camión)
-- =============================================================================

CREATE TABLE receptions (
    reception_id            SERIAL PRIMARY KEY,
    plant_id                INT REFERENCES plants(plant_id) NOT NULL,
    truck_id                INT REFERENCES trucks(truck_id),
    driver_id               INT REFERENCES drivers(driver_id),
    logistics_company_id    INT REFERENCES logistics_companies(logistics_company_id),
    reception_date          DATE NOT NULL,
    arrival_time            TIME,
    unloading_start_time    TIME,
    unloading_end_time      TIME,
    remission_guide_number  VARCHAR(100),
    sri_access_key          VARCHAR(49),     -- clave de acceso SRI (fase 2: integración API)
    warranty_letter_number  VARCHAR(100),
    arrival_temperature     NUMERIC(6,2),
    truck_condition_id      INT REFERENCES condition_levels(condition_id),
    ice_condition_id        INT REFERENCES condition_levels(condition_id),
    hygiene_condition_id    INT REFERENCES condition_levels(condition_id),
    observations            TEXT,
    created_by              INT REFERENCES users(user_id),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_receptions_date ON receptions (reception_date);
CREATE INDEX idx_receptions_sri  ON receptions (sri_access_key);

-- 1 camión ↔ N lotes; 1 lote ↔ N camiones (caso 1233 con 3 entregas).
CREATE TABLE reception_lots (
    reception_lot_id        SERIAL PRIMARY KEY,
    reception_id            INT REFERENCES receptions(reception_id) ON DELETE CASCADE,
    lot_id                  INT REFERENCES lots(lot_id) ON DELETE CASCADE,
    sequence_in_reception   INT,                 -- orden del lote dentro del camión
    delivery_index          INT DEFAULT 1,       -- 1, 2, 3 para multi-entrega del mismo lote
    received_lbs            NUMERIC(12,2),
    boxes_count             INT,                 -- kavetas
    bins_count              INT,                 -- bines
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (reception_id, lot_id, delivery_index)
);

-- Suministros que vienen en el camión (hielo, sal, sacos meta, kavetas, bines).
CREATE TABLE reception_supplies (
    reception_supply_id SERIAL PRIMARY KEY,
    reception_id        INT REFERENCES receptions(reception_id) ON DELETE CASCADE,
    supply_type_id      INT REFERENCES supply_types(supply_type_id) NOT NULL,
    quantity            NUMERIC(10,2) NOT NULL,
    unit                VARCHAR(20),
    description         VARCHAR(255),  -- "SACO DE HIELO FRANCLAR S.A."
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sellos de seguridad del camión (TCP506750, TCP506751, ...).
CREATE TABLE reception_seals (
    reception_seal_id SERIAL PRIMARY KEY,
    reception_id      INT REFERENCES receptions(reception_id) ON DELETE CASCADE,
    seal_number       VARCHAR(50) NOT NULL,
    is_intact         BOOLEAN DEFAULT TRUE,
    notes             TEXT,
    UNIQUE (reception_id, seal_number)
);

-- =============================================================================
-- ANÁLISIS DE CALIDAD (R-CC-001)
-- =============================================================================

CREATE TABLE quality_analyses (
    analysis_id                 SERIAL PRIMARY KEY,
    plant_id                    INT REFERENCES plants(plant_id) NOT NULL,
    analysis_date               DATE NOT NULL,
    analysis_time               TIME,
    shift                       shift_type,
    analyst_id                  INT REFERENCES users(user_id),

    -- Cabecera del R-CC-001
    sample_total_weight         NUMERIC(10,2),  -- "Peso total de la muestra" (g)
    total_units                 INT,            -- "Total unidades"
    global_grammage             NUMERIC(10,2),  -- "Gramaje global"
    so2_residual_ppm            NUMERIC(10,2),  -- "Residual metabisulfito (SO₂ ppm)"
    so2_global                  NUMERIC(10,2),  -- columna del Excel
    average_grammage            NUMERIC(10,2),  -- "Promedio (30-40)"
    average_classification_code VARCHAR(20),    -- el rango promedio: "30-40"
    product_temperature         NUMERIC(6,2),

    -- Métricas que aparecen también en el Excel (calculables, pero útiles cacheadas)
    gr_cc                       NUMERIC(10,2),
    c_kg                        NUMERIC(10,2),
    gr_sc                       NUMERIC(10,2),
    c_kg2                       NUMERIC(10,2),

    -- Resultado
    decision_id                 INT REFERENCES decisions(decision_id),
    destined_product_type       product_type,    -- "Producto para: Entero / Cola"
    global_defect_percentage    NUMERIC(6,2),
    good_product_percentage     NUMERIC(6,2),
    general_observations        TEXT,
    status                      analysis_status DEFAULT 'borrador',

    created_by                  INT REFERENCES users(user_id),
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at                   TIMESTAMP,

    -- No se puede validar/rechazar sin decisión
    CONSTRAINT chk_closed_has_decision CHECK (
        status NOT IN ('validado', 'rechazado') OR decision_id IS NOT NULL
    )
);

CREATE INDEX idx_qa_date   ON quality_analyses (analysis_date);
CREATE INDEX idx_qa_status ON quality_analyses (status);

-- M:N: 1 análisis cubre 1+ lotes (pooled), 1 lote puede tener 1+ análisis (re-test).
CREATE TABLE analysis_lots (
    analysis_id         INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    lot_id              INT REFERENCES lots(lot_id) ON DELETE CASCADE,
    contribution_lbs    NUMERIC(10,2),   -- libras del lote en la muestra (pooled)
    PRIMARY KEY (analysis_id, lot_id)
);

-- 1er, 2do, 3er muestreo del R-CC-001
CREATE TABLE analysis_samplings (
    sampling_id        SERIAL PRIMARY KEY,
    analysis_id        INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    sampling_index     INT NOT NULL CHECK (sampling_index BETWEEN 1 AND 3),
    units_count        INT,             -- total piezas en este muestreo
    defect_units       INT,             -- "Total defectos"
    good_units         INT,             -- "Total camarón bueno"
    defect_percentage  NUMERIC(6,2),
    good_percentage    NUMERIC(6,2),
    so2_ppm            NUMERIC(10,2),   -- SO₂ residual de este muestreo (algunos análisis tienen 1-3 lecturas distintas)
    UNIQUE (analysis_id, sampling_index)
);

CREATE TABLE sampling_defects (
    sampling_defect_id SERIAL PRIMARY KEY,
    sampling_id        INT REFERENCES analysis_samplings(sampling_id) ON DELETE CASCADE,
    defect_id          INT REFERENCES defects(defect_id) NOT NULL,
    units_count        INT,
    percentage         NUMERIC(6,2),
    UNIQUE (sampling_id, defect_id)
);

-- =============================================================================
-- ANÁLISIS ORGANOLÉPTICO (crudo y cocido)
-- =============================================================================

CREATE TABLE analysis_colors (
    analysis_color_id SERIAL PRIMARY KEY,
    analysis_id       INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    sample_state      sample_state NOT NULL,
    color_id          INT REFERENCES colors(color_id),
    UNIQUE (analysis_id, sample_state)
);

-- Permite varios sabores por (análisis, estado): "70% TIERRA LEVE - 30% TIERRA MODERADA"
CREATE TABLE analysis_flavors (
    analysis_flavor_id SERIAL PRIMARY KEY,
    analysis_id        INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    sample_state       sample_state NOT NULL,
    flavor_id          INT REFERENCES flavors(flavor_id) NOT NULL,
    intensity_id       INT REFERENCES intensities(intensity_id),
    percentage         NUMERIC(6,2)
);

CREATE INDEX idx_af_analysis ON analysis_flavors (analysis_id);

CREATE TABLE analysis_odors (
    analysis_odor_id SERIAL PRIMARY KEY,
    analysis_id      INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    sample_state     sample_state NOT NULL,
    odor_id          INT REFERENCES odors(odor_id) NOT NULL,
    intensity_id     INT REFERENCES intensities(intensity_id),
    presence         BOOLEAN DEFAULT FALSE,
    observations     TEXT
);

CREATE INDEX idx_ao_analysis ON analysis_odors (analysis_id);

-- =============================================================================
-- MINI-HISTOGRAMA (dentro del R-CC-001 — sección "Observaciones/Acciones")
-- =============================================================================

-- Lote 1233 ①: 75g/2pz/(20-30); 2340g/79pz/(30-40); 660g/27pz/(40-50)
CREATE TABLE analysis_size_distribution (
    distribution_id      SERIAL PRIMARY KEY,
    analysis_id          INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    cc_classification_id INT REFERENCES cc_classifications(cc_classification_id),
    weight_grams         NUMERIC(10,2),
    units_count          INT,
    average_grammage     NUMERIC(6,2),
    UNIQUE (analysis_id, cc_classification_id)
);

-- =============================================================================
-- HISTOGRAMA R-CC-034 (uno por lote, agregado del lote completo)
-- =============================================================================

CREATE TABLE lot_histograms (
    histogram_id              SERIAL PRIMARY KEY,
    lot_id                    INT REFERENCES lots(lot_id) ON DELETE CASCADE,
    histogram_date            DATE NOT NULL,
    histogram_time            TIME,
    plant_id                  INT REFERENCES plants(plant_id),
    total_units               INT,
    total_weight_grams        NUMERIC(10,2),
    average_grammage          NUMERIC(10,2),
    average_classification_cc VARCHAR(20),
    average_classification_sc VARCHAR(20),
    supervisor_id             INT REFERENCES users(user_id),
    jefe_calidad_id           INT REFERENCES users(user_id),
    notes                     TEXT,
    created_by                INT REFERENCES users(user_id),
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (lot_id)
);

-- Cada gramaje individual (5g, 6g, ... 52g) con piezas, peso total y clasificación.
CREATE TABLE histogram_entries (
    entry_id             SERIAL PRIMARY KEY,
    histogram_id         INT REFERENCES lot_histograms(histogram_id) ON DELETE CASCADE,
    grammage             INT NOT NULL,
    cc_classification_id INT REFERENCES cc_classifications(cc_classification_id),
    sc_classification_id INT REFERENCES sc_classifications(sc_classification_id),
    pieces_count         INT NOT NULL DEFAULT 0,
    total_weight_grams   NUMERIC(10,2),
    percentage           NUMERIC(6,2),
    UNIQUE (histogram_id, grammage)
);

-- =============================================================================
-- APROBACIONES Y FIRMAS
-- =============================================================================

-- Firmas del R-CC-001 (Supervisor + Jefe) y del R-CC-034 (idem).
CREATE TABLE analysis_approvals (
    approval_id     SERIAL PRIMARY KEY,
    analysis_id     INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    user_id         INT REFERENCES users(user_id) NOT NULL,
    approval_role   approval_role NOT NULL,
    approval_status approval_status DEFAULT 'pending',
    comments        TEXT,
    approved_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (analysis_id, approval_role)
);

CREATE TABLE histogram_approvals (
    approval_id     SERIAL PRIMARY KEY,
    histogram_id    INT REFERENCES lot_histograms(histogram_id) ON DELETE CASCADE,
    user_id         INT REFERENCES users(user_id) NOT NULL,
    approval_role   approval_role NOT NULL,
    approval_status approval_status DEFAULT 'pending',
    comments        TEXT,
    approved_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (histogram_id, approval_role)
);

-- =============================================================================
-- ATTACHMENTS (fotos y documentos)
-- =============================================================================

-- Cada foto siempre cuelga de un lote (raíz de trazabilidad).
-- Opcionalmente se asocia a una recepción / análisis / histograma / defecto.
CREATE TABLE attachments (
    attachment_id      SERIAL PRIMARY KEY,
    attachment_type_id INT REFERENCES attachment_types(attachment_type_id) NOT NULL,

    lot_id             INT REFERENCES lots(lot_id) ON DELETE CASCADE NOT NULL,
    reception_id       INT REFERENCES receptions(reception_id) ON DELETE SET NULL,
    analysis_id        INT REFERENCES quality_analyses(analysis_id) ON DELETE SET NULL,
    histogram_id       INT REFERENCES lot_histograms(histogram_id) ON DELETE SET NULL,
    defect_id          INT REFERENCES defects(defect_id),

    file_url           TEXT NOT NULL,
    file_name          VARCHAR(255),
    mime_type          VARCHAR(100),
    file_size_bytes    BIGINT,
    comment            TEXT,
    uploaded_by        INT REFERENCES users(user_id),
    uploaded_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_att_lot       ON attachments (lot_id);
CREATE INDEX idx_att_analysis  ON attachments (analysis_id);
CREATE INDEX idx_att_histogram ON attachments (histogram_id);

-- =============================================================================
-- REGLAS DE CALIDAD Y ALERTAS
-- =============================================================================

CREATE TABLE quality_rules (
    rule_id         SERIAL PRIMARY KEY,
    rule_name       VARCHAR(150) NOT NULL,
    metric          VARCHAR(100) NOT NULL,    -- 'so2_global', 'global_defect_pct', 'pct_melanosis', ...
    operator        VARCHAR(5) NOT NULL,      -- '>', '<', '>=', '<=', '='
    threshold_value NUMERIC(10,2),
    severity        alert_severity,
    action_message  TEXT,
    active          BOOLEAN DEFAULT TRUE
);

CREATE TABLE quality_alerts (
    alert_id      SERIAL PRIMARY KEY,
    analysis_id   INT REFERENCES quality_analyses(analysis_id) ON DELETE CASCADE,
    rule_id       INT REFERENCES quality_rules(rule_id),
    alert_message TEXT,
    severity      alert_severity,
    status        alert_status DEFAULT 'open',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at   TIMESTAMP,
    resolved_by   INT REFERENCES users(user_id)
);

CREATE INDEX idx_alerts_status ON quality_alerts (status);

-- =============================================================================
-- AUDITORÍA
-- =============================================================================

CREATE TABLE audit_log (
    audit_id    BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(100) NOT NULL,
    record_id   INT NOT NULL,
    action      VARCHAR(20) NOT NULL,   -- INSERT / UPDATE / DELETE
    old_value   JSONB,
    new_value   JSONB,
    changed_by  INT REFERENCES users(user_id),
    changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_when   ON audit_log (changed_at);

-- =============================================================================
-- TRIGGER: actualizar updated_at en quality_analyses
-- =============================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_qa_updated_at
    BEFORE UPDATE ON quality_analyses
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
