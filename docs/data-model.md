# Modelo de datos — CEA EXPORT (control de calidad)

App de control de calidad de materia prima en CEAEXPORT. Reemplaza los formularios en papel R-CC-001 (organoléptico) y R-CC-034 (histograma) y el Excel manual "LOTES RECIBIDOS Y DETERMINACIÓN DE SULFITOS".

## Origen del diseño

El modelo se construyó cruzando 4 fuentes:

1. **R-CC-001** — Control de Calidad Análisis Materia Prima (paper, vigente 29/12/2020).
2. **R-CC-034** — Histograma de Clasificación de Camarón (paper, vigente 08/09/2025).
3. **Excel** — `LOTES RECIBIDOS Y DETERMINACIÓN DE SULFITOS (V).xlsx` (~36 columnas).
4. **PDF lote 1233 CAMORENSA** — caso real con 3 entregas, 2 R-CC-001, 1 R-CC-034 y fotos de báscula y muestras de defectos clasificadas.

El spec inicial (`1.docx`) sirvió de punto de partida pero tenía errores estructurales que se corrigieron tras revisar los formularios reales.

## Decisiones clave

### 1. El lote se recibe en N camiones

**Hallazgo del PDF lote 1233**: el mismo lote llegó en 3 entregas (`1233 ①`, `1233 ②`, `1233 ③`) con placas y guías diferentes pero mismo proveedor/piscina/origen.

Modelo: tabla puente `reception_lots(reception_id, lot_id, delivery_index)` con `delivery_index` para distinguir entregas del mismo lote. Cubre los 3 casos reales:

| Caso | Modelo |
|---|---|
| 1 camión → 1 lote | `reception_lots`: 1 fila |
| 1 camión → N lotes | `reception_lots`: N filas, mismo `reception_id` |
| 1 lote → N camiones (1233) | `reception_lots`: N filas, mismo `lot_id`, distintos `delivery_index` |

### 2. El análisis y el lote son M:N

Tres patrones operativos:

| # | Patrón | Implicación |
|---|---|---|
| 1 | 1 lote → N entregas → 1 análisis (agregado) | Caso 1233: análisis único con 3 R-CC-001 de papel |
| 2 | 1 lote → 1 entrega → 1 análisis | Caso típico |
| 3 | N lotes → 1 análisis "pooled" | Cogen muestra de 3 lotes y hacen un análisis |

Modelo: tabla puente `analysis_lots(analysis_id, lot_id, contribution_lbs)`. Cubre los 3.

### 3. Crudo y cocido se evalúan por separado

El R-CC-001 tiene secciones gemelas para "Camarón crudo" y "Camarón cocido" con olor, sabor, color cada una. El Excel solo guarda uno (cocido).

Modelo: las tablas `analysis_colors`, `analysis_flavors`, `analysis_odors` tienen columna `sample_state ENUM('crudo', 'cocido')`. Una pareja de filas por análisis.

### 4. Tres muestreos, no uno

El R-CC-001 permite 1er, 2do y 3er muestreo. En la práctica solo se llenan 1 o 2 (ver lote 1233).

Modelo: `analysis_samplings(sampling_index 1-3)` con sus piezas y porcentajes. Los defectos cuelgan del muestreo, no del análisis: `sampling_defects(sampling_id, defect_id, percentage)`.

### 5. Histograma R-CC-034 = entidad propia

El Excel guarda `GR C/C`, `C/KG`, `GR S/C`, `C/KG2` y "GRAMOS PROMEDIO" para todo lote. Esos números **salen** de un histograma. El R-CC-034 captura la distribución completa de gramajes individuales (5g–52g) y clasificaciones CC/SC.

Modelo:
- `lot_histograms` — uno por lote (cabecera con totales y promedios)
- `histogram_entries` — un registro por gramaje individual con piezas, peso y clasificación
- `cc_classifications` (10-20, 20-30, …, 120/150) — catálogo
- `sc_classifications` (U12, U15, 16-20, …, 110/130) — catálogo

Adicionalmente, el R-CC-001 tiene un **mini-histograma manuscrito** en el campo "Observaciones" (caso 1233: `75g/2pz/(20-30)`, `2340g/79pz/(30-40)`, `660g/27pz/(40-50)`). Este es un muestreo distinto del R-CC-034. Se modela como `analysis_size_distribution` y va asociado al análisis, no al lote.

### 6. El Excel es una `VIEW`, no una tabla

`v_lotes_recibidos` reproduce el Excel actual columna por columna desde las tablas reales. Nadie edita un Excel a mano; se exporta on-demand desde la BD.

### 7. Defectos: catálogo unión

El R-CC-001 (2020) y el Excel (legacy) tienen listas de defectos divergentes; en la práctica los analistas escriben a mano defectos que no están preimpresos (ej. en lote 1233 escriben "cabeza roja" sobre "melanosis").

Modelo: `defects` contiene la **unión** de ambas listas (19 defectos), con flags `in_paper_form` e `in_legacy_excel` y `active` para activar/desactivar sin perder histórico.

### 8. Decisión separada de observaciones

En el Excel actual la decisión va escrita en el campo `OBSERVACIÓN` como texto libre ("LOTE RECHAZADO" en lote 0694). Esto mezcla decisión con notas y deja casos como el lote 0711 (81% defectos) sin constancia formal.

Modelo:
- `decisions` — catálogo (Aceptado / Aceptado con obs / Rechazado / Reproceso / Desviar a cola)
- `quality_analyses.decision_id` — FK obligatoria al cerrar el análisis (`CHECK` constraint: no se puede `validado`/`rechazado` sin `decision_id`)
- `quality_analyses.general_observations` — texto libre solo para notas, no decisiones

### 9. Lotes "especiales"

El lote 0707 ("LOTE PARA GERENCIA") está casi vacío. No es un lote comercial.

Modelo: `lot_categories` (comercial / gerencia / muestra / prueba) con flag `requires_full_analysis`. La UI usa esto para relajar validaciones según categoría.

### 10. Suministros y sellos del camión

La guía de remisión del lote 1233 detalla 10 BINES, 30 KAVETAS ANARANJADAS, 200 SACOS DE HIELO, 20 SACOS DE METABISULFITO, 0.5 SACOS DE SAL — además del camarón. Y hay decenas de números de sello (TCP506750…).

Modelo:
- `reception_supplies(reception_id, supply_type_id, quantity)` — para auditoría de lo que entra al patio
- `reception_seals(reception_id, seal_number, is_intact)` — para trazabilidad de seguridad
- `supply_types` — catálogo (BINES, KVAN, HIELO, META, SAL, OTRO)

### 11. Catálogo + dropdown para todo lo finito

Principio rector de UX: cada campo con un universo finito de valores es FK a un catálogo, no `VARCHAR` libre. Solo `TEXT` para `observations`/`notes` reales.

Catálogos modelados (todos editables sin migración):
plantas · proveedores · procedencias · piscinas · logística · camiones · choferes · tratadores · químicos · categorías de lote · colores · sabores · intensidades · olores · defectos · decisiones · clasificaciones CC · clasificaciones SC · tipos de suministro · tipos de attachment · niveles de condición (camión / hielo / higiene)

### 12. Forward-compat con SRI y QR (fase 2)

Sin construir las features ahora, dejamos preparados:
- `receptions.sri_access_key` (49 dígitos) — para escáner de código de barras de la guía electrónica del SRI
- `lots.qr_code` (UUID) — para etiquetas digitales que reemplacen las manuscritas en la báscula

## Diagrama de relaciones (alto nivel)

```
                    ┌─────────────┐
                    │  receptions │ (entregas físicas, 1 por camión)
                    └──────┬──────┘
                           │ 1:N
                ┌──────────┴──────────┐
                ▼                     ▼
        reception_supplies     reception_seals
                ▼
        ┌─────────────────┐
        │ reception_lots  │ (M:N entre receptions y lots)
        └────────┬────────┘
                 │ N:1
                 ▼
            ┌─────────┐         ┌─────────────┐
            │  lots   │◄────────┤ lot_treaters│ (M:N tratadores)
            └────┬────┘         └─────────────┘
                 │ 1:1
                 ├──► lot_histograms ──► histogram_entries
                 │
                 │ M:N
                 ▼
        ┌─────────────────┐
        │ analysis_lots   │
        └────────┬────────┘
                 │ N:1
                 ▼
        ┌──────────────────┐
        │ quality_analyses │
        └────────┬─────────┘
                 │
        ┌────────┼─────────┬─────────────┬───────────────┬──────────────┐
        ▼        ▼         ▼             ▼               ▼              ▼
   samplings  colors    flavors       odors      size_distribution   approvals
        │
        ▼
  sampling_defects
```

## Vistas

| Vista | Reemplaza | Uso |
|---|---|---|
| `v_lotes_recibidos` | Excel completo | Reporte general / Power BI |
| `v_defects_by_lot` | — | Análisis de defectos por proveedor/piscina |
| `v_flavors_by_lot` | — | Tendencias de sabor (tierra, etc.) |
| `v_supplier_performance` | — | KPI mensual por proveedor |
| `v_pending_analyses` | Bandeja "Análisis pendientes" | Pantalla 4 del flujo |
| `v_histogram_summary` | — | Distribución de tallas por lote |

## Próximo paso

- [ ] Validar este modelo con el laboratorio (1 sesión, 1 hora con un analista y el supervisor de calidad).
- [ ] Definir flujo concreto de UI (qué pantalla precarga qué, qué autocompleta qué).
- [ ] Inicializar repo: backend FastAPI + frontend React + Postgres en docker-compose.
- [ ] Rebanada vertical: pantalla de recepción → 1 lote → 1 análisis básico, end-to-end.
