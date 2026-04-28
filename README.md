# CEA EXPORT — Control de calidad de materia prima

App para reemplazar los formularios en papel **R-CC-001** (análisis materia prima) y **R-CC-034** (histograma de clasificación) y el Excel manual *"Lotes recibidos y determinación de sulfitos"* en CEAEXPORT.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + React Query
- **DB:** PostgreSQL 16 (puerto **5433** local para no chocar con otra Postgres)
- **Auth:** JWT con refresh tokens + invitaciones generadas por admin
- **Almacenamiento de ficheros:** local (`backend/uploads/<lot_id>/<uuid>.<ext>`), servido vía StaticFiles
- **Dev:** Docker Compose para la BD

## Estructura

```
ceaexport/
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── api/                # auth, admin, catalogs, receptions, analyses, attachments
│   │   ├── core/               # config, db, security
│   │   ├── models/             # ORM: auth, catalogs, operations, analyses, attachments
│   │   ├── schemas/            # Pydantic
│   │   └── services/
│   ├── scripts/                # bootstrap_admin
│   └── uploads/                # ficheros subidos (gitignored)
├── frontend/                   # React + Vite
│   └── src/
│       ├── api/                # cliente axios + auto-refresh
│       ├── components/         # CatalogSelect, AttachmentsSection, …
│       ├── contexts/           # AuthContext
│       ├── hooks/              # useCatalog
│       ├── pages/              # auth, recepcion, analisis, admin, …
│       └── routes/
├── db/                         # SQL fuente: schema, seeds, views, migrations
├── docs/                       # diseño, flujo de UI, status
├── documentos/                 # fuentes reales (formularios, Excel, PDFs)
├── docker-compose.yml
└── README.md
```

## Pantallas implementadas

| Pantalla | Ruta | Estado |
|---|---|---|
| Login + sesión + reset password | `/login`, `/reset/:token`, `/invitacion/:token` | ✅ |
| Inicio (tiles por rol) | `/` | ✅ |
| Perfil (cambiar nombre/contraseña) | `/perfil` | ✅ |
| Admin de usuarios (invitar, roles, deshabilitar) | `/admin/users` | ✅ |
| **Recepción de camión** (single-page) | `/recepcion` | ✅ |
| **Bandeja de muestras** (tabs por estado, búsqueda) | `/analisis` | ✅ |
| **Ficha de análisis R-CC-001** (cabecera sticky + secciones) | `/analisis/lote/:lotId` o `/analisis/:analysisId` | ✅ |
| Histograma R-CC-034 | `/histogramas` | 🚧 pendiente |
| Búsqueda global de lote | `/buscar` | 🚧 pendiente |
| Dashboard / reportes | `/dashboard` | 🚧 pendiente |

### Detalles de la ficha de análisis

- Cabecera sticky con código de lote, badge de estado, tags, datos identificativos del lote y trazabilidad colapsable (entregas con placa, chofer, temperatura, lbs).
- Toolbar destacado con Analista + Fecha de análisis + botón **Guardar resultados** (siempre a la vista).
- Secciones: Datos generales · Datos físicos · Crudo · Cocido · Muestreos (1/2/3) · Distribución CC · Decisión · Fotos y archivos.
- **Subida de fotos/videos** (drag & drop, preview, lightbox, borrar) por análisis.
- Bandeja con tabs Todos / Pendientes / En análisis / Liberados / Rechazados con conteo en cada uno.

## Empezar a desarrollar

### 1. Levantar la base de datos

`docker-compose.yml` monta `db/schema.sql`, `db/seeds.sql` y `db/views.sql` como `docker-entrypoint-initdb.d` y se ejecutan al primer arranque.

```bash
docker compose up -d db
# Aplicar migración de extensiones de auth (reset_token + user_invitations)
docker compose exec -T db psql -U cea -d cea < db/migrations/01_auth_extensions.sql
```

La BD escucha en **localhost:5433** (no 5432, para evitar conflicto con otras Postgres locales).

Si necesitas reiniciar la base desde cero: `docker compose down -v`.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -e .
copy .env.example .env          # editar JWT_SECRET_KEY
uvicorn app.main:app --reload   # http://localhost:8000
```

API docs en `http://localhost:8000/docs`.

### 3. Crear el primer admin (bootstrap)

Solo se ejecuta cuando la base está vacía de usuarios:

```bash
cd backend
python -m scripts.bootstrap_admin \
    --email admin@cea.com \
    --name "Administrador" \
    --password "TuClav3Fuerte!"
```

Reglas de password: 8+ caracteres, 1 mayúscula, 1 minúscula, 2 números, 1 especial.

A partir de aquí, los siguientes usuarios se crean por **invitación** desde el panel de administración (`/admin/users` en el frontend).

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Vite hace proxy automático de `/api/*` y `/uploads/*` al backend (puerto 8000).

### Alternativa: todo con Docker

```bash
docker compose up
# En otra terminal:
docker compose exec backend python -m scripts.bootstrap_admin \
    --email admin@cea.com --name "Administrador" --password "TuClav3Fuerte!"
```

## Endpoints principales

```
POST   /api/auth/login                    login y refresh
POST   /api/auth/refresh                  rotar tokens
GET    /api/auth/me                       usuario actual

GET    /api/catalogs/{name}               read-only o creatable según catálogo
POST   /api/catalogs/{name}               crear ítem (suppliers, ponds, drivers, …)

POST   /api/receptions                    crear recepción con N lotes anidados
GET    /api/receptions                    listado resumen
GET    /api/receptions/{id}               detalle

GET    /api/analyses/board                tablero general (filtro ?state=)
GET    /api/analyses/pending              solo lotes sin análisis cerrado
GET    /api/analyses/lot-context/{lotId}  cabecera del lote + entregas (camiones)
GET    /api/analyses/by-lot/{lotId}       análisis vigente del lote (si existe)
GET    /api/analyses/{id}                 ficha completa
POST   /api/analyses                      crear (upsert atómico de secciones)
PUT    /api/analyses/{id}                 actualizar (mientras no esté cerrado)

POST   /api/attachments                   multipart, asociado a lote/análisis/recepción
GET    /api/attachments                   filtrar por ?lot_id|analysis_id|reception_id
DELETE /api/attachments/{id}              borrar (físico + metadata)
GET    /uploads/...                       servir ficheros subidos
```

## Documentación clave

- [docs/data-model.md](docs/data-model.md) — modelo de datos y porqué de cada decisión
- [docs/ui-flow.md](docs/ui-flow.md) — flujo pantalla por pantalla, listo para validar con laboratorio
- [docs/status.md](docs/status.md) — estado actual y próximos pasos

## Roles

| Código | Nombre | Acceso |
|---|---|---|
| `admin` | Administrador | todo |
| `recepcion` | Recepción | crear recepciones y lotes |
| `analista_lab` | Analista de laboratorio | hacer análisis e histogramas |
| `supervisor_calidad` | Supervisor de calidad | validar primer nivel |
| `jefe_calidad` | Jefe de control de calidad | validar nivel final |
| `consulta` | Solo consulta | dashboards y reportes |

## Plantas

- **CEA DURÁN** (Durán)
- **CEAEXPORT** (Guayaquil)

## Convenciones del proyecto

- **Entrada de datos:** todo campo con un universo finito de opciones se modela como FK a un catálogo (no `VARCHAR` libre). En la UI: dropdown, chips o radios — nunca texto libre, salvo `observations`/`notes`.
- **Formularios en una sola página:** las pantallas de captura van en un único scroll con secciones, no en steppers multi-paso.
- **El Excel actual es una `VIEW`**, no una tabla editable: lo reproducen `v_lotes_recibidos`, `v_lot_board`, etc.
- **Multi-entrega:** un lote puede llegar en varias recepciones (1 lote ↔ N recepciones), con `delivery_index` en la junction.
