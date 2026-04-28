# Estado del proyecto — handoff

**Última sesión:** 2026-04-28
**Próxima:** retomar desde aquí.

## Qué hay hecho

### Sesión 2026-04-27 (modelo de datos)
- Modelo de datos completo y documentado en [data-model.md](data-model.md).
- Schema PostgreSQL en [`db/schema.sql`](../db/schema.sql) — ~30 tablas, 8 ENUMs, índices, constraints, trigger de `updated_at`.
- Catálogos sembrados con valores reales en [`db/seeds.sql`](../db/seeds.sql) (extraídos del Excel + formularios + PDF lote 1233).
- Vistas de BI en [`db/views.sql`](../db/views.sql), incluida `v_lotes_recibidos` que reproduce el Excel actual columna por columna.

### Sesión 2026-04-28 (UI flow + repo)
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
- [ ] **Rebanada vertical de RECEPCIÓN:** primera pantalla operativa real. Backend (`POST /api/receptions`, `POST /api/lots`, etc.) + frontend F2.1/F2.2/F2.3.
  - Modelos SQLAlchemy de domain: `Reception`, `Lot`, `Supplier`, `Pond`, `Origin`, `LogisticsCompany`, `Truck`, `Driver`, `Treater`, `Chemical`.
  - Endpoints CRUD de catálogos.
  - Endpoint de creación de recepción con lotes anidados (transaccional).
  - Pantallas F2.1 (camión), F2.2 (lotes), F2.3 (resumen).
- [ ] **Validar el modelo con el laboratorio** (sigue pendiente desde la sesión anterior).

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
