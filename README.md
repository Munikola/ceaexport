# CEA EXPORT — Control de calidad de materia prima

App para reemplazar los formularios en papel **R-CC-001** (organoléptico) y **R-CC-034** (histograma) y el Excel manual *"Lotes recibidos y determinación de sulfitos"* en CEAEXPORT.

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **DB:** PostgreSQL 16
- **Auth:** JWT con refresh tokens + invitaciones (admin)
- **Dev:** Docker Compose

## Estructura

```
ceaexport/
├── backend/        # FastAPI
├── frontend/       # React + Vite
├── db/             # SQL fuente: schema, seeds, views
├── docs/           # diseño, flujo de UI, status
├── documentos/     # fuentes reales (formularios, Excel, PDFs)
├── docker-compose.yml
└── README.md
```

## Empezar a desarrollar

### 1. Levantar la base de datos

`docker-compose.yml` ya monta `db/schema.sql`, `db/seeds.sql` y `db/views.sql`
como `docker-entrypoint-initdb.d` y se ejecutan al primer arranque.

```bash
docker compose up -d db
# Aplicar la migración de extensiones de auth (reset_token + user_invitations)
docker compose exec -T db psql -U cea -d cea < db/migrations/01_auth_extensions.sql
```

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

API docs en http://localhost:8000/docs.

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

A partir de aquí, los siguientes usuarios se crean por **invitación** desde el
panel de administración (`/admin/users` en el frontend).

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

### Alternativa: todo con Docker

```bash
docker compose up
# Después, en otro terminal:
docker compose exec backend python -m scripts.bootstrap_admin \
    --email admin@cea.com --name "Administrador" --password "TuClav3Fuerte!"
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
