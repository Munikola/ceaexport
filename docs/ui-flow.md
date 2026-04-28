# Flujo de UI — CEA EXPORT

Diseño pantalla por pantalla de la app. **Este documento es el contrato a validar con el laboratorio antes de codear.**

## Principios rectores

| Principio | Implicación práctica |
|---|---|
| **Catálogo > texto libre** | Cada campo finito es `<select>`, chip o segmented control. Texto libre solo en `observaciones`. |
| **Autocompletar lo previsible** | Fecha = hoy, hora = ahora, planta = última usada, turno = derivado de la hora. |
| **Pocos toques** | Cualquier acción frecuente en ≤ 3 toques desde Inicio. |
| **Validación inline** | Errores aparecen al perder el foco, no solo al guardar. |
| **Auto-save de borradores** | Nunca se pierde lo escrito si se cae la red o el móvil. |
| **Mobile-first donde se ensucian las manos** | Recepción y fotos en móvil/tablet. Laboratorio en tablet. Dashboard en desktop. |
| **Touch targets ≥ 44px** | Botones grandes; los analistas usan guantes. |
| **Una pantalla = una decisión** | No agolpar 30 campos. Bloques colapsables o pasos. |

## Roles y dispositivos

| Rol | Dispositivo principal | Pantallas que ve |
|---|---|---|
| Recepción | Móvil/tablet en patio | F2 (recepción) |
| Analista laboratorio | Tablet en mesa | F3 bandeja, F4 análisis, F5 histograma |
| Supervisor calidad | Tablet/desktop | F3, F4, F5, F6 validación |
| Jefe control calidad | Desktop | F6 validación, F7 dashboard |
| Admin | Desktop | F8 administración |
| Consulta (gerencia) | Desktop/móvil | F7 dashboard |

## Mapa de navegación

```
                       ┌─────────────┐
                       │  F1 Inicio  │
                       └──────┬──────┘
        ┌──────────┬──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼
   F2 Recepción  F3 Bandeja  F7 Buscar  F7 Dashboard  F8 Admin
        │          │
        ▼          ▼
   F2.1 Camión   F4 Análisis (5 pasos)
        │          │
        ▼          ▼
   F2.2 Lotes    F5 Histograma R-CC-034
        │          │
        ▼          ▼
   F2.3 Resumen  F6 Validación + firmas
```

---

# F1 — Inicio

**Dispositivo:** móvil, tablet, desktop.
**Quién:** todos.

Layout simple, máximo 6 botones grandes:

| Botón | Acción | Visible para |
|---|---|---|
| Nueva recepción | → F2.1 | recepción, admin |
| Análisis pendientes | → F3 | analista, supervisor, jefe, admin |
| Buscar lote | → F7.1 | todos |
| Histogramas | → F5 lista | analista, supervisor, jefe, admin |
| Dashboard | → F7.2 | jefe, admin, consulta, gerencia |
| Administración | → F8 | admin |

Header global (siempre visible):
- Logo CEA · Planta seleccionada (selector si tienes acceso a más de una) · Turno actual (T/D | T/N derivado de la hora) · Usuario · Logout.

---

# F2 — Recepción de camión

**Dispositivo:** móvil/tablet en el patio.
**Quién:** recepción.

Tres pasos consecutivos. El paso anterior queda visible y editable (acordeón).

## F2.1 — Datos del camión

**Auto-precargado:**
- Fecha de llegada = hoy
- Hora de llegada = ahora
- Planta = la del header
- Turno = derivado de la hora

**Campos:**

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| Fecha de llegada | date | auto | editable |
| Hora de llegada | time | auto | editable |
| Empresa logística | dropdown + add | `logistics_companies` | opción "+ Añadir" en línea |
| Placa del camión | autocomplete | `trucks` | si no existe → "+ Añadir nuevo camión" abre modal |
| Chofer | autocomplete | `drivers` | idem |
| Guía de remisión | text | manual | (fase 2: escáner SRI) |
| Clave SRI | text 49 dígitos | manual/escáner | OPCIONAL (fase 2 lo precarga todo) |
| Carta de garantía | text | manual | opcional |
| Temperatura de llegada | number | manual | unidad: °C, validación: -5 a 30 |
| Estado del camión | dropdown | `condition_levels` (truck) | Bueno / Regular / Malo / N/A |
| Estado del hielo | dropdown | `condition_levels` (ice) | Suficiente / Regular / Insuficiente / Sin hielo / N/A |
| Higiene | dropdown | `condition_levels` (hygiene) | Buena / Regular / Mala / N/A |
| Observaciones | textarea | manual | opcional |

**Bloque de suministros (colapsable, "Añadir suministros del camión"):**

Tabla simple con un selector y un número:

| Suministro | Cantidad | Unidad |
|---|---|---|
| dropdown (`supply_types`) | number | auto del catálogo |

Botón "+ añadir línea". Validación: cantidad > 0.

**Bloque de sellos (colapsable):**

Lista de números de sello (uno por línea o pegado en bulk separado por espacios/comas). Checkbox "todos los sellos están intactos" por defecto marcado.

**Acciones:**
- **Guardar y continuar a lotes** → crea `receptions` + `reception_supplies` + `reception_seals`, va a F2.2.
- **Guardar borrador** → guarda con `status = draft`, vuelve a F1.

**Auto-save:** cada 30s mientras se edita.

## F2.2 — Lotes del camión

**Pregunta inicial (en banner grande):** *"¿Cuántos lotes trae este camión?"*

Botón **"+ Añadir lote"**. Por cada lote, un acordeón con:

| Campo | Tipo | Origen | Notas |
|---|---|---|---|
| Código de lote | text | manual | viene en la guía / camión. Validación: único por año. Si ya existe en este año → aviso "Lote ya registrado, ¿es una entrega adicional?" |
| Entrega Nº | number | auto (1, 2, 3…) | Solo aparece si el lote ya existe → autoincrementa `delivery_index` |
| Lote cliente | text | manual | opcional |
| Categoría de lote | segmented | `lot_categories` | default: Comercial |
| Proveedor | autocomplete | `suppliers` | "+ Añadir" en línea |
| Procedencia | autocomplete | `origins` | "+ Añadir" en línea |
| Piscina (PSC) | autocomplete | `ponds` filtrados por proveedor | "+ Añadir" en línea |
| Tipo de producto | segmented | enum | ENTERO / COLA |
| Libras recibidas | number | manual | validación > 0 |
| Nº kavetas | number | manual | opcional |
| Nº bines | number | manual | opcional |
| Fecha de pesca | date | manual | opcional, default = ayer |
| Tratadores | multi-select | `treaters` | varios; opción "PROVEEDOR" siempre arriba |
| Producto químico | dropdown | `chemicals` | Grillo / Metabisulfito / Aleman (BASF) |
| Observaciones | textarea | manual | opcional |

**Acciones por lote:**
- Eliminar (icono X)
- Duplicar (útil cuando varios lotes del mismo proveedor)

**Acciones globales:**
- **+ Añadir otro lote**
- **Continuar a resumen** → F2.3

**Validación al continuar:** todos los lotes tienen al menos `lot_code`, `supplier_id`, `pond_id`, `product_type`, `received_lbs`.

## F2.3 — Resumen y envío a análisis

Tabla de los lotes creados:

| Lote | Proveedor | Piscina | Producto | Lbs | Estado |
|---|---|---|---|---|---|
| 1233-① | CAMORENSA | 51 | ENTERO | 10.000 | Pendiente análisis |
| 1233-② | CAMORENSA | 51 | ENTERO | 8.000 | Pendiente análisis |

Total libras: suma. Total lotes: count.

**Acciones:**
- **Editar recepción** → vuelve a F2.1 con todo cargado
- **+ Añadir otro lote** → vuelve a F2.2
- **Enviar a análisis** → cambia `status` de los lotes a "pendiente análisis" y vuelve a F1 con confirmación

**Mobile-only nice to have:** botón "Imprimir/Compartir resumen" → genera PDF y abre share-sheet (para WhatsApp al laboratorio).

---

# F3 — Bandeja de análisis pendientes

**Dispositivo:** tablet/desktop.
**Quién:** analista, supervisor.

Lista de lotes con `status = pending_analysis`, ordenada por hora de recepción. Cada fila:

| Lote | Proveedor | Producto | Hora recepción | Hace | Acción |
|---|---|---|---|---|---|
| 1233-① | CAMORENSA | ENTERO | 15:20 | 2h | [Iniciar análisis] |

Filtros (chips arriba):
- Planta · Turno · Proveedor · Producto (Entero/Cola) · Fecha · Categoría de lote

Búsqueda por código de lote.

Indicador visual:
- Verde: < 2h desde recepción
- Amarillo: 2-4h
- Rojo: > 4h (riesgo cadena de frío)

Acciones:
- **Iniciar análisis** → F4 con el lote precargado
- **Análisis pooled de varios lotes** → seleccionar 2+ lotes con checkbox y botón "Iniciar análisis pooled" → F4 con todos los lotes vinculados

---

# F4 — Análisis de calidad (R-CC-001)

**Dispositivo:** tablet (preferido) o desktop.
**Quién:** analista.

5 pasos en wizard horizontal con stepper. El analista puede saltar entre pasos pero no validar el análisis hasta tenerlos todos.

## F4.1 — Datos generales

**Auto-precargado:**
- Lote(s) seleccionados (chips no editables)
- Fecha = hoy
- Hora = ahora
- Planta y turno = del header
- Analista = usuario actual

**Campos manuales:**

| Campo | Tipo | Validación |
|---|---|---|
| Peso muestra (g) | number | > 0 |
| Total unidades | number | > 0 |
| Gramaje global (g) | number | calculado (peso/unidades) pero editable |
| Promedio | number | rango sugerido por gramaje |
| Clasificación promedio | dropdown | `cc_classifications` o `sc_classifications` según producto |
| Temperatura producto (°C) | number | -5 a 30, alerta si > 4 |
| Residual metabisulfito SO₂ (ppm) | number | > 0 |
| SO₂ global (ppm) | number | calculable o manual |
| GR C/C | number | auto desde gramaje, editable |
| C/KG | number | = 1000 / GR C/C, auto |
| GR S/C | number | auto sugerido (~66% GR C/C), editable |
| C/KG2 | number | = 1000 / GR S/C, auto |

**Acción:** Siguiente → F4.2.

## F4.2 — Organoléptico (crudo y cocido)

Dos columnas lado a lado: **Crudo** y **Cocido**. Cada una:

**Olor**
- Dropdown (`odors`): Característico (default) / Lodo / Combustible / Amoniaco / Otro
- Si ≠ Característico:
  - Intensidad: chips (Leve / Moderado / Fuerte)
  - Observación: texto opcional

**Sabor**
- Botón "Añadir descriptor"
- Cada descriptor = sabor + intensidad + porcentaje:
  - Sabor: dropdown (`flavors`)
  - Intensidad: chips (`intensities`)
  - %: number con slider
- La app muestra el resto implícito: *"Característico: 30% (auto)"*
- Validación: suma de descriptores no-característico ≤ 100%

**Color**
- Grid de 9 botones (con muestra visual cuando se tenga la imagen):
  - A1 CLARO · A2 CLARO · A1-A2 CLARO
  - A3 CLARO · A3 SEMI-OSCURO · A3 OSCURO
  - A4 OSCURO · A4-A5 OSCURO · A5 MUY OSCURO

**Acción:** Siguiente → F4.3.

## F4.3 — Defectos (3 muestreos)

Tabs: 1er muestreo · 2do muestreo · 3er muestreo (los muestreos opcionales se pueden activar/desactivar).

Por muestreo:

| Defecto | Nº camarón | % |
|---|---|---|
| Cabeza floja | input number | input number |
| Cabeza naranja | input number | input number |
| ... (los 19 catalogados) | | |

**Cálculos automáticos al pie:**
- Total defectos: suma
- Total camarón bueno: total unidades - total defectos
- % defectos global: calculado
- Top 3 defectos: highlight visual
- Alertas inline: "Melanosis > 10%", "Defectos globales > 40%"

**Atajo de entrada:** modo "solo % conocido" — si el analista solo escribe %, la app calcula Nº a partir del total de unidades del paso F4.1.

**Modo "muestreo único":** si solo se va a hacer 1 muestreo (típico), el analista lo marca y los tabs 2 y 3 se ocultan.

**Acción:** Siguiente → F4.4.

## F4.4 — Mini-histograma + Fotos

**Mini-histograma** (lo que va en "Observaciones/Acciones" del R-CC-001 papel):

Tabla simple, una línea por rango CC:

| Rango | Peso (g) | Piezas | Promedio (g) |
|---|---|---|---|
| 20-30 | 75 | 2 | 28 (auto: peso/piezas) |
| 30-40 | 2340 | 79 | 34 (auto) |
| 40-50 | 660 | 27 | 41 (auto) |

**Validación:** suma de piezas = `total_units` del paso F4.1; suma de pesos ≈ `peso_muestra`.

**Fotos** (sección colapsable):

Botón grande **"📷 Tomar foto"** o **"📁 Subir desde galería"**.

Por cada foto:
| Campo | Tipo | Notas |
|---|---|---|
| Categoría | dropdown | `attachment_types` (foto_defecto, foto_pesaje, foto_camion, ...) |
| Defecto asociado | dropdown | solo si categoría = foto_defecto |
| Comentario | text | opcional |

Auto-metadatos: lote, usuario, timestamp.

Galería en grid con preview. Tap para ampliar, swipe para borrar.

**Acción:** Siguiente → F4.5.

## F4.5 — Resultado y decisión

Resumen automático:

```
LOTE 1233-① — CAMORENSA
Producto: ENTERO  ·  Lbs: 10.000
SO₂ global: 80   ·  Color cocido: A3 SEMI-OSCURO
Sabor cocido: CARACTERÍSTICO
% defectos global: 31%
Defecto principal: CABEZA NARANJA 9.2%

[Alertas]
⚠ Defectos globales > 30%
```

**Recomendación automática** (según `quality_rules`):
- ✅ Aceptado
- ⚠️ Aceptado con observación
- ❌ Rechazado
- 🔄 Reproceso
- ↘️ Desviar a cola

El analista **debe seleccionar una decisión** (no se puede cerrar sin ella). Por defecto, la recomendada.

**Producto para:** segmented Entero / Cola (puede diferir del tipo recibido — ej. entero rechazado se desvía a cola).

**Observaciones generales:** textarea libre.

**Acciones:**
- **Guardar borrador** → vuelve a F3
- **Enviar a validación** → cambia `status` a `en_revision`, va a F6

---

# F5 — Histograma R-CC-034

**Dispositivo:** tablet.
**Quién:** analista.

Pantalla independiente accesible desde:
- F1 (botón Histogramas)
- F4.5 (botón "Hacer histograma de este lote" antes de cerrar)
- F3 (acción "Crear histograma" en cada lote)

**Cabecera:**
- Lote (precargado o seleccionable)
- Fecha = hoy
- Hora = ahora
- Planta = header

**Tabla principal — entrada por gramaje individual:**

Réplica del R-CC-034 paper. Por cada gramaje (5g a 52g, cubriendo todos los rangos CC y SC):

| Gramaje | Piezas | Peso total (g) | Clasificación CC | Clasificación SC |
|---|---|---|---|---|
| 28 | input | auto (gramaje × piezas) | auto del catálogo | auto del catálogo |

**Atajo táctil:** botón "+1" al lado de cada gramaje para sumar piezas rápido (en lugar de teclear).

**Cálculos al pie:**
- Total piezas
- Peso total
- Gramos promedio
- Clasificación promedio CC y SC

**Sección de resultado:**

| Rango CC | Piezas | % |
|---|---|---|
| 20-30 | 2 | 2% |
| 30-40 | 78 | 73% |
| 40-50 | 27 | 25% |

**Acciones:**
- **Guardar borrador**
- **Enviar a validación** → cambia `status` y va a F6 con histograma cargado

---

# F6 — Validación y firmas

**Dispositivo:** tablet/desktop.
**Quién:** supervisor de calidad y jefe de control de calidad.

Vista de solo lectura del análisis (y del histograma si lo hay), con todos los datos del R-CC-001 + R-CC-034 visibles.

**Acciones del supervisor:**
- ✓ Aprobar
- ✗ Rechazar (requiere comentario)
- 📝 Devolver al analista (requiere comentario)

**Acciones del jefe de control de calidad** (solo cuando supervisor ya aprobó):
- ✓ Validar definitivamente
- ✗ Rechazar

**Firma:** PIN del usuario o biometría móvil.

Cuando ambos firman → estado = `validado`, queda inmutable. PDF auto-generado.

**Acciones post-validación:**
- 📥 Generar PDF (replica del R-CC-001 + R-CC-034 papel)
- 📊 Exportar a Excel (replica del Excel actual)
- 🔒 Cerrar (vuelve a F1)

---

# F7 — Búsqueda, dashboard, reportes

## F7.1 — Buscar lote

**Dispositivo:** todos.

Buscador de una sola línea: código de lote, proveedor, fecha, piscina. Resultado: lista paginada de lotes con su estado.

Al seleccionar un lote: timeline:
- Recepción (con foto del camión)
- Análisis (con resultados y fotos de defectos)
- Histograma
- Validaciones y firmas
- Decisión final

## F7.2 — Dashboard

**Dispositivo:** desktop / tablet.
**Quién:** jefe, admin, gerencia.

KPIs grandes arriba:
- Lotes recibidos hoy / semana / mes
- % rechazos
- SO₂ promedio
- Defectos promedio
- Top 3 proveedores por volumen
- Top 3 proveedores por % defectos

Gráficos:
- Lotes/día con stacked decisión (apilado por Aceptado / Rechazado / Reproceso)
- Tendencia SO₂ por proveedor
- Heatmap defectos × proveedor
- % defectos por mes

Filtros globales: planta, fecha (rango), proveedor, producto.

**Datos:** todos vienen de las views (`v_lotes_recibidos`, `v_supplier_performance`, `v_defects_by_lot`). Nada se calcula en frontend.

**Power BI:** misma fuente. La app expone las views por API o conexión directa a Postgres con un usuario solo-lectura.

## F7.3 — Reportes

Genera reportes ad-hoc:
- Excel "LOTES RECIBIDOS" (replica el Excel actual desde `v_lotes_recibidos`) — descarga directa.
- PDF de un lote individual — desde F7.1.
- Reporte mensual por proveedor.
- Reporte de no-conformidades (rechazos + reprocesos) por rango.

---

# F8 — Administración

**Dispositivo:** desktop.
**Quién:** admin.

Gestión de catálogos. Una sección por catálogo, todos con la misma UI:

- Listar (paginado, filtro de activo/inactivo)
- Crear (modal con campos según el catálogo)
- Editar
- Activar / desactivar (no eliminar — preserva histórico)

Catálogos editables: plantas, proveedores, procedencias, piscinas, logística, camiones, choferes, tratadores, químicos, suministros, defectos, sabores, intensidades, olores, colores, decisiones, categorías de lote, niveles de condición, reglas de calidad.

**Gestión de usuarios** (lo monta el skill `auth-system`):
- Invitar usuario por email (genera link de registro)
- Asignar rol
- Resetear password
- Activar / desactivar
- Editar perfil propio (nombre, password)

---

# Smart defaults — resumen

| Campo | Default |
|---|---|
| Fecha | hoy |
| Hora | ahora |
| Planta | última usada (persiste en localStorage) |
| Turno | T/D si 06:00-18:00, T/N en otro caso |
| Categoría lote | comercial |
| Tratador | "PROVEEDOR" si ya hay químico = METABISULFITO solo |
| Olor | Característico |
| Sabor | Característico (100%) |
| Decisión | la recomendada por las reglas |

# Validaciones críticas

| Validación | Dónde | Mensaje |
|---|---|---|
| Lote duplicado en el año | F2.2 al teclear código | "Lote ya existe en 2026 — ¿es una entrega adicional? [Sí, +1 entrega] [No, cambiar código]" |
| Sin decisión al cerrar | F4.5 / F6 | "No puedes cerrar sin seleccionar decisión" |
| Suma defectos > 100% | F4.3 | "% global pasa de 100, revisa muestreos" |
| Suma piezas histograma ≠ total | F4.4 / F5 | "Las piezas no cuadran con el total declarado" |
| Temperatura > 4°C | F2.1 / F4.1 | alerta amarilla "Cadena de frío comprometida" |
| SO₂ > 100 ppm | F4.1 | alerta crítica |
| Sabor combustible | F4.2 | alerta crítica + sugerencia "Rechazado" |

# Auto-save y borradores

- Cada formulario auto-guarda cada 30s en `status = draft`.
- Al volver a entrar al mismo flujo, banner: *"Tienes una recepción/análisis a medias del [hora]. ¿Continuar o descartar?"*
- Borradores antiguos (>72h) se purgan tras confirmación al admin.

# Offline-first (consideración)

El patio puede tener mala cobertura. Mínimo viable:
- Recepción se puede llenar offline; se guarda local y sincroniza al volver la conexión.
- Fotos se guardan local hasta que sube.
- El laboratorio normalmente está conectado.

Implementación: PWA + IndexedDB + service worker. No bloquea fase 1 si tu cobertura es buena, pero conviene plantearlo desde el principio para no rehacer.

# Pendiente de validar con el laboratorio

- [ ] ¿La pantalla de análisis (F4) en 5 pasos funciona, o prefieren todo en uno con bloques colapsables?
- [ ] ¿El R-CC-034 lo hacen en la misma estación o en otra mesa? (decide si F5 es continuación de F4 o separada).
- [ ] ¿Quién firma exactamente? (¿el analista también firma o solo supervisor + jefe?).
- [ ] ¿Cuál es la regla real para "T/D" vs "T/N"? (asumido 06-18 / 18-06).
- [ ] ¿Cómo identifican un "lote multi-entrega" en la guía del 2º camión? ¿Aparece "1233-2" escrito o lo deciden ellos?
- [ ] Umbrales reales de las quality_rules (los del seed son tentativos).
- [ ] ¿Hay alguna decisión que falte? ("Aceptado bajo concesión", "Cuarentena", etc.)
- [ ] ¿La gerencia ve el dashboard en móvil o solo desktop?
