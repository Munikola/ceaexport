# Estado del proyecto — handoff

**Última sesión:** 2026-05-02
**Próxima:** **APLICAR MIGRACIÓN SQL + DEPLOY** antes de cualquier otra cosa.

## ⚠️ Pendiente CRÍTICO al volver mañana

El último commit (`0a6031e`) introduce **vistas materializadas** que el dashboard
usa para ser rápido. Si no aplicas la migración, los endpoints petan.

### Paso 1 — Migración SQL en Cloud SQL (Cloud Shell)

```bash
cd ~/ceaexport
git pull
# Asegurar proxy a Cloud SQL
pgrep -f cloud-sql-proxy > /dev/null || (cd ~/ceaexport && nohup ./cloud-sql-proxy dnadata:europe-west1:cea-db > /tmp/proxy.log 2>&1 &) && sleep 3

# Aplicar migración 02 (índices + 5 vistas materializadas + función refresh)
PGPASSWORD="$(cat ~/cea-db-password.txt)" psql -h 127.0.0.1 -U postgres -d cea -f db/migrations/02_perf_indexes_and_mv.sql > /tmp/migr.log 2>&1
echo "Exit: $?" && tail -10 /tmp/migr.log

# Verificar (debe listar 5 filas)
PGPASSWORD="$(cat ~/cea-db-password.txt)" psql -h 127.0.0.1 -U postgres -d cea -c "SELECT matviewname FROM pg_matviews WHERE matviewname LIKE 'mv_%';"
```

### Paso 2 — Deploy backend + frontend

```bash
./deploy/deploy.sh
```

(Tecléalo a mano, no copies del chat — el formato Markdown rompe el comando.)

### Paso 3 — Probar y avanzar

1. Login como admin → ver nuevo item **🔔 Alertas** en el menú.
2. CRUD de reglas: editar, pausar, crear. 7 reglas seedeadas inicialmente.
3. Comprobar que el Dashboard sigue cargando rápido (ahora usa las MVs).
4. Histogramas debe mostrar los 1236 lotes distribuidos por talla.

## Lo siguiente (cuando los pasos 1-3 estén OK)

- **Rediseño visual del DashboardPage** según el mockup que mandó el usuario:
  - 7 KPIs (añadir "Sin decisión" como card aparte)
  - Gráfico evolución diaria con **doble eje** (lotes + % defectos como línea
    con MA7 punteada)
  - Tabla "**Últimos lotes con mayor % defectos**" — usa `worst-lots` endpoint
    nuevo (`/api/reports/dashboard/worst-lots`)
  - Panel "**Alertas operativas**" lateral — usa `operational-alerts` endpoint
    que YA evalúa quality_rules dinámicamente
  - El sidebar lateral del mockup NO se hace (decisión del usuario)
  - Mantener el TopNav horizontal actual

- **Refresh automático de MVs**: ahora son manuales. Opciones:
  - Cron via Cloud Scheduler diario que llame `POST /api/admin/refresh-reports`
  - Trigger en BD que refresque al cerrar un análisis
  - Por ahora, refresh manual cuando hagan falta datos frescos

## Estado actual de los servicios desplegados (Cloud Run, europe-west1)

- Backend: `cea-backend-peerfce4sa-ew.a.run.app` (revisión última hasta `cea-backend-00012-xxx` cuando despliegues)
- Frontend: `cea-frontend-peerfce4sa-ew.a.run.app`
- Cloud SQL: `dnadata:europe-west1:cea-db` (Postgres 16, db-g1-small)
- Bucket fotos: `gs://cea-uploads-dnadata`
- Service account runtime: `cea-runtime@dnadata.iam.gserviceaccount.com`
- Secretos: `cea-jwt-secret`, `cea-db-password`

---

## Cómo retomar la prueba (paso por paso)

Todo está configurado y guardado. La DB y el backend están parados. Para retomar:

```powershell
# 1. Asegúrate de que Docker Desktop esté arrancado.

# 2. Levantar la BD (los datos persisten — el admin sigue creado):
cd C:\Users\imugarza.BIOLANMB\Documents\GitHub\ceaexport
docker compose start db

# 3. Arrancar backend (en una terminal):
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload

# 4. Arrancar frontend (en OTRA terminal):
cd C:\Users\imugarza.BIOLANMB\Documents\GitHub\ceaexport\frontend
npm install     # solo la primera vez
npm run dev

# 5. Abrir http://localhost:5173 en el navegador
#    Login: admin@cea.com  /  Cea2026Test!
```

**Notas importantes para no tropezar otra vez:**
- El puerto de la BD Docker es **5433** (el 5432 está ocupado por otra Postgres tuya, ajena al proyecto).
- El admin **ya está creado** en la BD. NO vuelvas a correr el bootstrap.
- Password admin: `Cea2026Test!` (con la C mayúscula, la t mayúscula, y el ! al final).
- El bug de SQLAlchemy de la tabla `lot_treaters` ya está corregido en el código.

## Qué hay hecho

### Sesión 2026-04-27 (modelo de datos)
- Modelo de datos completo y documentado en [data-model.md](data-model.md).
- Schema PostgreSQL en [`db/schema.sql`](../db/schema.sql) — ~30 tablas, 8 ENUMs, índices, constraints, trigger de `updated_at`.
- Catálogos sembrados con valores reales en [`db/seeds.sql`](../db/seeds.sql) (extraídos del Excel + formularios + PDF lote 1233).
- Vistas de BI en [`db/views.sql`](../db/views.sql), incluida `v_lotes_recibidos` que reproduce el Excel actual columna por columna.

### Sesión 2026-04-28 (UI flow + repo + auth + recepción)
- Flujo de UI completo en [ui-flow.md](ui-flow.md): F1 Inicio · F2 Recepción (3 pasos) · F3 Bandeja · F4 Análisis (5 pasos) · F5 Histograma · F6 Validación · F7 Búsqueda/Dashboard/Reportes · F8 Admin.
- Repo inicializado con git, `.gitignore`, `docker-compose.yml`, README.
- Backend FastAPI esqueleto + sistema de autenticación completo:
  - Argon2 + JWT con refresh
  - Login, /me, refresh, perfil
  - Gestión de usuarios (admin)
  - Invitaciones (admin genera enlace)
  - Reset de password (admin genera enlace)
  - Bootstrap script para crear el primer admin
- Frontend React + Vite + TypeScript + Tailwind:
  - AuthContext con auto-refresh de tokens
  - Páginas: Login, AcceptInvitation, ResetPassword, Profile, UsersPage (admin), Home con tiles según rol
  - ProtectedRoute con check de rol
- Migración SQL `01_auth_extensions.sql` para añadir reset_token + user_invitations sin recrear el schema.
- **Rebanada vertical de RECEPCIÓN end-to-end (F2.1, F2.2, F2.3):**
  - Backend: modelos ORM de catálogos (12) + operaciones (Reception, Lot, ReceptionLot)
  - Endpoint genérico `GET/POST /api/catalogs/{name}` para todos los dropdowns
  - Endpoint `POST /api/receptions` transaccional con N lotes anidados, multi-entrega automática
  - Frontend: hook `useCatalog`, `CatalogSelect`, `CatalogAutocomplete` con "+ añadir nuevo"
  - Página `/recepcion` con stepper de 3 pasos, smart-defaults (fecha=hoy, hora=ahora)
  - Pantalla de éxito tras guardar

## Cómo probar el schema (no se ha probado todavía)

```bash
docker run --name cea-pg -e POSTGRES_PASSWORD=cea -p 5432:5432 -d postgres:16
docker exec -i cea-pg psql -U postgres -d postgres < db/schema.sql
docker exec -i cea-pg psql -U postgres -d postgres < db/seeds.sql
docker exec -i cea-pg psql -U postgres -d postgres < db/views.sql
```

## Decisiones tomadas

| # | Decisión | Razón |
|---|---|---|
| 1 | Lote = código externo (viene con el camión), no autogenerado | "El lote nos viene dado" |
| 2 | Unicidad de lote por año `(lot_code, lot_year)` | Correlativo aparente que reinicia anual (0001-Ene → 1233-Abr) |
| 3 | Reception ↔ Lot en M:N | Caso 1233: 3 camiones, 1 lote |
| 4 | Analysis ↔ Lot en M:N | También cubre "muestra pooled de 3 lotes" |
| 5 | Crudo y cocido como `sample_state` separado | El R-CC-001 evalúa los dos |
| 6 | 3 muestreos (`sampling_index 1-3`) por análisis | El R-CC-001 los pide |
| 7 | Histograma R-CC-034 = entidad propia por lote | No estaba en la spec original |
| 8 | Decisión obligatoria para cerrar análisis | Hoy se pierde (caso 0711 con 81% defectos sin disposición) |
| 9 | Categorías de lote (comercial / gerencia / muestra / prueba) | Caso 0707 "LOTE PARA GERENCIA" |
| 10 | Suministros y sellos del camión como tablas | Detalle real de la guía de remisión |
| 11 | Catálogo + dropdown para TODO campo finito | UX rector: "que sea muy sencilla la introducción" |
| 12 | Excel = `VIEW`, no tabla | Nadie edita un Excel a mano |
| 13 | `sri_access_key` y `qr_code` como nullables | Fase 2 (lectura de guía SRI + etiquetas digitales) |

## Pendientes — para retomar

### Antes de tocar código de app

- [ ] **Validar el modelo con el laboratorio.** 1 hora con un analista + supervisor. Lo crítico:
  - Los nombres de campo casan con cómo hablan ellos
  - Confirmar que el `lot_code` realmente reinicia cada año
  - Confirmar umbrales de las `quality_rules` (SO₂, % defectos, temperatura, melanosis)
  - Confirmar si hay otros formularios R-CC-XXX que no hemos visto
- [ ] **Probar el schema** corriendo los 3 SQL contra un Postgres limpio (snippet arriba).

### Próximo trabajo

- [ ] **Probar todo el stack end-to-end:**
  ```bash
  docker compose up -d db
  docker compose exec -T db psql -U cea -d cea < db/migrations/01_auth_extensions.sql
  cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -e .
  copy .env.example .env  # editar JWT_SECRET_KEY
  python -m scripts.bootstrap_admin --email admin@cea.com --name "Admin" --password "TuClav3Fuerte!"
  uvicorn app.main:app --reload
  cd ../frontend && npm install && npm run dev
  ```
  Login → invitar usuario → abrir enlace → aceptar → login con nuevo usuario.
- [ ] **Iteración 2 sobre RECEPCIÓN** (lo que quedó fuera del MVP de hoy):
  - Suministros (hielo, sal, sacos meta, kavetas, bines) con catálogo `supply-types`
  - Sellos de seguridad del camión
  - Auto-save de borradores
  - Validación cliente: lote duplicado en el año (modal "¿es entrega adicional?")
- [ ] **Bandeja de análisis pendientes (F3)**: vista `v_pending_analyses` ya existe en BD; falta el endpoint y la pantalla.
- [ ] **Análisis de calidad (F4)**: el más denso (5 pasos). Modelos: `QualityAnalysis`, `AnalysisSampling`, `SamplingDefect`, `AnalysisColor/Flavor/Odor`, `AnalysisSizeDistribution`.
- [ ] **Histograma R-CC-034 (F5)**.
- [ ] **Validación / firmas (F6)** + PDF generation.
- [ ] **Dashboard / reportes (F7)** consumiendo las views de BI.
- [ ] **Validar el modelo con el laboratorio** (sigue pendiente desde la primera sesión).

### Fase 2 (no ahora)

- [ ] Integración SRI: escáner de código de barras de la guía electrónica → autocompletar recepción
- [ ] Etiquetas digitales con QR para reemplazar la etiqueta CEA manuscrita en la báscula
- [ ] Vision LLM para digitalizar el histórico de formularios manuscritos

## Cómo retomar la sesión

Decirme algo como: *"sigamos por el flujo de UI"* / *"vamos a inicializar el repo"* / *"validé el modelo con el laboratorio, te cuento"*. La memoria del proyecto está al día y reabro contexto leyendo este archivo y `data-model.md`.

## Documentos fuente (en este repo)

- `1.docx` — spec inicial generada por LLM (punto de partida, NO la verdad)
- `documentos/` — fuentes reales:
  - `Lote 1233 (1-2-3) proveedor CAMORENSA.pdf` — caso real con 3 entregas
  - `LOTES RECIBIDOS Y DETERMINACIÓN DE SULFITOS (V).xlsx` — log denormalizado
  - `WhatsApp Image 2026-04-23 at 11.20.51.jpeg` — formulario R-CC-001 vacío (referencia)
- `docs/data-model.md` — diseño y porqué de cada decisión
- `db/` — schema + seeds + views
