-- =============================================================================
-- CEA EXPORT — Catálogos sembrados
-- =============================================================================
-- Valores reales extraídos de:
--   - R-CC-001 (paper, vigente 29/12/2020)
--   - R-CC-034 (paper, vigente 08/09/2025)
--   - "LOTES RECIBIDOS Y DETERMINACIÓN DE SULFITOS (V).xlsx"
--   - PDF lote 1233 CAMORENSA
-- =============================================================================

-- =============================================================================
-- ROLES
-- =============================================================================
INSERT INTO roles (role_code, role_name) VALUES
    ('admin',              'Administrador'),
    ('recepcion',          'Recepción'),
    ('analista_lab',       'Analista de Laboratorio'),
    ('supervisor_calidad', 'Supervisor de Calidad'),
    ('jefe_calidad',       'Jefe de Control de Calidad'),
    ('consulta',           'Solo consulta');

-- =============================================================================
-- PLANTAS
-- =============================================================================
INSERT INTO plants (plant_code, plant_name, location) VALUES
    ('CEA_DURAN', 'CEA DURÁN', 'Durán'),
    ('CEAEXPORT', 'CEAEXPORT', 'Guayaquil');

-- =============================================================================
-- CATEGORÍAS DE LOTE
-- =============================================================================
INSERT INTO lot_categories (category_code, category_name, requires_full_analysis) VALUES
    ('comercial', 'Comercial',        TRUE),
    ('gerencia',  'Gerencia',         FALSE),  -- caso lote 0707 "LOTE PARA GERENCIA"
    ('muestra',   'Muestra técnica',  FALSE),
    ('prueba',    'Prueba',           FALSE);

-- =============================================================================
-- LOGÍSTICA
-- =============================================================================
INSERT INTO logistics_companies (company_name) VALUES
    ('TRANSCAMCORP'),
    ('TRANSPDANNAMAR'),
    ('SOFICAM'),
    ('CARGO PESCA');

-- =============================================================================
-- PROCEDENCIAS
-- =============================================================================
INSERT INTO origins (origin_name) VALUES
    ('TAURA'),
    ('SABANA GRANDE'),
    ('NARANJAL'),
    ('CHURUTE'),
    ('HUAQUILLAS'),
    ('PT. HUALTACO'),
    ('PT. JELY'),
    ('PT. PITAHAYA'),
    ('FRAGATA'),
    ('DELIA'),
    ('SANTA ROSA'),
    ('YAGUACHI'),
    ('DURÁN'),
    ('AYALAN'),
    ('BALAO'),
    ('DALA');

-- =============================================================================
-- PRODUCTOS QUÍMICOS
-- =============================================================================
INSERT INTO chemicals (chemical_name) VALUES
    ('GRILLO'),
    ('METABISULFITO'),
    ('ALEMAN (BASF)');

-- =============================================================================
-- COLORES
-- =============================================================================
INSERT INTO colors (color_code, color_name, color_grade, color_modifier, sort_order) VALUES
    ('A1_CLARO',      'A1 CLARO',       'A1',    'CLARO',       10),
    ('A2_CLARO',      'A2 CLARO',       'A2',    'CLARO',       20),
    ('A1_A2_CLARO',   'A1-A2 CLARO',    'A1-A2', 'CLARO',       25),
    ('A3_CLARO',      'A3 CLARO',       'A3',    'CLARO',       30),
    ('A3_SEMI_OSC',   'A3 SEMI-OSCURO', 'A3',    'SEMI-OSCURO', 40),
    ('A3_OSCURO',     'A3 OSCURO',      'A3',    'OSCURO',      50),
    ('A4_OSCURO',     'A4 OSCURO',      'A4',    'OSCURO',      60),
    ('A4_A5_OSCURO',  'A4-A5 OSCURO',   'A4-A5', 'OSCURO',      65),
    ('A5_MUY_OSCURO', 'A5 MUY OSCURO',  'A5',    'MUY-OSCURO',  70);

-- =============================================================================
-- SABORES
-- =============================================================================
INSERT INTO flavors (flavor_name, is_default) VALUES
    ('Característico', TRUE),
    ('Tierra',         FALSE),
    ('Choclo',         FALSE),
    ('Combustible',    FALSE),
    ('Gallinaza',      FALSE);

-- =============================================================================
-- INTENSIDADES
-- =============================================================================
INSERT INTO intensities (intensity_code, intensity_name, sort_order) VALUES
    ('ninguna',   'Ninguna',   0),
    ('leve',      'Leve',      1),
    ('moderado',  'Moderado',  2),
    ('fuerte',    'Fuerte',    3),
    ('presencia', 'Presencia', 4);

-- =============================================================================
-- OLORES
-- =============================================================================
INSERT INTO odors (odor_name, is_default) VALUES
    ('Característico', TRUE),
    ('Lodo',           FALSE),
    ('Combustible',    FALSE),
    ('Amoniaco',       FALSE),
    ('Otro',           FALSE);

-- =============================================================================
-- DEFECTOS — UNIÓN del R-CC-001 (paper) + Excel + práctica observada
-- =============================================================================
INSERT INTO defects (defect_code, defect_name, defect_category, in_paper_form, in_legacy_excel, sort_order) VALUES
    -- En el R-CC-001 actual (paper, vigente 2020)
    ('flacido',            'Camarón flácido',          'Textura',       TRUE,  TRUE,  10),
    ('mudado',             'Camarón mudado',           'Condición',     TRUE,  TRUE,  20),
    ('picado',             'Camarón picado',           'Daño físico',   TRUE,  TRUE,  30),
    ('necrosis_leve',      'Camarón necrosis leve',    'Sanitario',     TRUE,  FALSE, 40),
    ('deforme',            'Camarón deforme',          'Morfología',    TRUE,  TRUE,  50),
    ('quebrado',           'Camarón quebrado',         'Daño físico',   TRUE,  TRUE,  60),
    ('necrosis_fuerte',    'Camarón necrosis fuerte',  'Sanitario',     TRUE,  FALSE, 70),
    ('hepat_reventado',    'Camarón hepato/reventado', 'Sanitario',     TRUE,  FALSE, 80),
    ('cabeza_floja',       'Camarón cabeza floja',     'Cabeza',        TRUE,  TRUE,  90),
    ('cabeza_naranja',     'Camarón cabeza naranja',   'Cabeza',        TRUE,  TRUE, 100),
    ('melanosis',          'Camarón con melanosis',    'Color',         TRUE,  TRUE, 110),
    ('deshidratado',       'Camarón deshidratado',     'Conservación',  TRUE,  TRUE, 120),
    ('juvenil',            'Camarón juvenil',          'Talla',         TRUE,  FALSE,130),
    -- En el Excel pero ya no en el paper (mantenidos por compatibilidad histórica)
    ('cabeza_roja',        'Camarón cabeza roja',      'Cabeza',        FALSE, TRUE, 140),
    ('cabeza_descolgada',  'Camarón cabeza descolgada','Cabeza',        FALSE, TRUE, 150),
    ('cabeza_reventada',   'Camarón cabeza reventada', 'Cabeza',        FALSE, TRUE, 160),
    ('atq_bacteriano',     'Ataque bacteriano',        'Sanitario',     FALSE, TRUE, 170),
    ('semi_rosado',        'Camarón semi-rosado',      'Color',         FALSE, TRUE, 180),
    -- Solo aparece en observaciones / texto libre del Excel
    ('arenilla_intestino', 'Arenilla en intestino',    'Contaminación', FALSE, FALSE, 190);

-- =============================================================================
-- DECISIONES
-- =============================================================================
INSERT INTO decisions (decision_code, decision_name, is_approval, is_rejection, requires_action, sort_order) VALUES
    ('aceptado',       'Aceptado',                  TRUE,  FALSE, FALSE, 10),
    ('aceptado_obs',   'Aceptado con observación',  TRUE,  FALSE, FALSE, 20),
    ('rechazado',      'Rechazado',                 FALSE, TRUE,  FALSE, 30),
    ('reproceso',      'Reproceso',                 FALSE, FALSE, TRUE,  40),
    ('desviar_cola',   'Desviar a cola',            FALSE, FALSE, TRUE,  50);

-- =============================================================================
-- CLASIFICACIONES CON CABEZA (CC) — del R-CC-034
-- =============================================================================
INSERT INTO cc_classifications (range_code, min_count, max_count, sort_order) VALUES
    ('10-20',   10,  20,  10),
    ('20-30',   20,  30,  20),
    ('30-40',   30,  40,  30),
    ('40/50',   40,  50,  40),
    ('50/60',   50,  60,  50),
    ('60/70',   60,  70,  60),
    ('70/80',   70,  80,  70),
    ('80/100',  80, 100,  80),
    ('100/120',100, 120,  90),
    ('120/150',120, 150, 100);

-- =============================================================================
-- CLASIFICACIONES SIN CABEZA (SC) — del R-CC-034
-- =============================================================================
INSERT INTO sc_classifications (range_code, min_count, max_count, sort_order) VALUES
    ('U12',       0,  12,  10),
    ('U15',      12,  15,  20),
    ('16-20',    16,  20,  30),
    ('21-25',    21,  25,  40),
    ('26-30',    26,  30,  50),
    ('31/35',    31,  35,  60),
    ('36-40',    36,  40,  70),
    ('41/50',    41,  50,  80),
    ('51/60',    51,  60,  90),
    ('61/70',    61,  70, 100),
    ('71/90',    71,  90, 110),
    ('91/110',   91, 110, 120),
    ('110/130', 110, 130, 130);

-- =============================================================================
-- SUMINISTROS (códigos vistos en guías de remisión del lote 1233)
-- =============================================================================
INSERT INTO supply_types (supply_code, supply_name, default_unit) VALUES
    ('BINES', 'Bines',                    'unidades'),
    ('KVAN',  'Kavetas (KV) Anaranjadas', 'unidades'),
    ('HIELO', 'Sacos de hielo',           'sacos'),
    ('META',  'Sacos de metabisulfito',   'sacos'),
    ('SAL',   'Sacos de sal',             'sacos'),
    ('OTRO',  'Otro suministro',          'unidades');

-- =============================================================================
-- CONDICIONES (camión, hielo, higiene) — un solo catálogo, tres tipos
-- =============================================================================
INSERT INTO condition_levels (condition_type, condition_code, condition_name, sort_order) VALUES
    -- Estado del camión
    ('truck',   'bueno',        'Bueno',         10),
    ('truck',   'regular',      'Regular',       20),
    ('truck',   'malo',         'Malo',          30),
    ('truck',   'no_aplica',    'No aplica',     99),
    -- Estado del hielo / conservación
    ('ice',     'suficiente',   'Suficiente',    10),
    ('ice',     'regular',      'Regular',       20),
    ('ice',     'insuficiente', 'Insuficiente',  30),
    ('ice',     'sin_hielo',    'Sin hielo',     40),
    ('ice',     'no_aplica',    'No aplica',     99),
    -- Higiene del camión
    ('hygiene', 'buena',        'Buena',         10),
    ('hygiene', 'regular',      'Regular',       20),
    ('hygiene', 'mala',         'Mala',          30),
    ('hygiene', 'no_aplica',    'No aplica',     99);

-- =============================================================================
-- TIPOS DE ATTACHMENT
-- =============================================================================
INSERT INTO attachment_types (type_code, type_name) VALUES
    ('foto_defecto',   'Foto de defecto (evidencia)'),
    ('foto_pesaje',    'Foto de pesaje en báscula'),
    ('foto_camion',    'Foto del camión'),
    ('foto_muestra',   'Foto de muestra general'),
    ('foto_cocido',    'Foto de muestra cocida'),
    ('guia_remision',  'Guía de remisión'),
    ('carta_garantia', 'Carta de garantía'),
    ('documento',      'Documento general'),
    ('otro',           'Otro');

-- =============================================================================
-- REGLAS DE CALIDAD INICIALES (umbrales tentativos — ajustar con el laboratorio)
-- =============================================================================
INSERT INTO quality_rules (rule_name, metric, operator, threshold_value, severity, action_message) VALUES
    ('SO₂ alto',                   'so2_global',                '>',   100,  'critical', 'SO₂ por encima de 100 ppm'),
    ('SO₂ residual bajo',          'so2_global',                '<',    30,  'warn',     'SO₂ residual demasiado bajo'),
    ('Defectos críticos',          'global_defect_percentage',  '>',    50,  'critical', 'Defectos globales > 50% — revisar'),
    ('Defectos altos',             'global_defect_percentage',  '>',    40,  'warn',     'Defectos globales > 40%'),
    ('Temperatura producto alta',  'product_temperature',       '>',     4,  'critical', 'Temperatura > 4°C — cadena de frío comprometida'),
    ('Melanosis alta',             'pct_melanosis',             '>',    10,  'warn',     'Melanosis por encima del 10%'),
    ('Combustible presente',       'flavor_combustible',        '=',     1,  'critical', 'Sabor combustible detectado — rechazo probable');

-- =============================================================================
-- PROVEEDORES (extraídos del Excel — completar con catastro real)
-- =============================================================================
INSERT INTO suppliers (supplier_name) VALUES
    ('PRODUMAR'),
    ('LIMBOMAR'),
    ('PESQUESOL'),
    ('GOLDENSHRIMP'),
    ('EXPOLLFASEA'),
    ('SOFIA OJEDA'),
    ('VICTOR PINTADO CORDERO'),
    ('EMCAMEX'),
    ('ARIRANG'),
    ('PATRICIO ROMERO BARBA'),
    ('ANTONIO MACAS'),
    ('CAMARONES ROLESA'),
    ('CARLOS CAMINOS'),
    ('EDGAR APONTE CALDERON'),
    ('OSWALDO BUSTAMANTE'),
    ('JOSE MEDINA LOAIZA'),
    ('CAMORENSA'),
    ('MARELUCSA'),
    ('PRODEXCAM'),
    ('ROSA JUMBO CALDERON'),
    ('EVER PONTON TORO'),
    ('CELISTCORP'),
    ('JONI CORDOVA'),
    ('PITIMAR'),
    ('AQUAM'),
    ('EDUARDO APONTE'),
    ('PESYCAM'),
    ('EDWIN RENGUEL'),
    ('INVERCAMOROSA'),
    ('AGROCAMARON'),
    ('ESCALABSHRIMP'),
    ('EDISON ROMERO');

-- =============================================================================
-- TRATADORES (extraídos del Excel)
-- =============================================================================
-- "PROVEEDOR" como entidad genérica para casos donde lo trató el propio proveedor.
INSERT INTO treaters (full_name, is_proveedor) VALUES
    ('PROVEEDOR',          TRUE),
    ('CHICHANDE GILBERTO', FALSE),
    ('FRANCISCO V.',       FALSE),
    ('FREIRE',             FALSE),
    ('LA TORRE',           FALSE),
    ('BURGOS MARIUXI',     FALSE),
    ('DARWIN VILLAMAR',    FALSE),
    ('TUAREZ R.',          FALSE),
    ('MATAMOROS',          FALSE),
    ('MERINO FELIX',       FALSE),
    ('QUIMIS EDWIN',       FALSE),
    ('VILLAMAR FRANCISCO', FALSE),
    ('MANTAMOROS JAVIER',  FALSE),
    ('LATORRE CARLOS',     FALSE),
    ('JAMES FREIRE',       FALSE),
    ('MANTUANO JAVIER',    FALSE),
    ('LUDEÑA MIGUEL',      FALSE),
    ('VILLAMAR DARWIN',    FALSE);
