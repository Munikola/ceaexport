# Deploy a Google Cloud (Cloud Run + Cloud SQL + GCS)

## Pre-requisitos (una sola vez)

Asumiendo `PROJECT_ID=dnadata` y `REGION=europe-west1`.

### 1. APIs activas, Cloud SQL creada, bucket creado, secretos creados

Ya hechos en sesión anterior. Verificación rápida:

```bash
gcloud sql instances describe cea-db --format="value(name,state)"
gcloud storage buckets describe gs://cea-uploads-dnadata --format="value(name)"
gcloud secrets list --filter="name~cea-" --format="value(name)"
gcloud iam service-accounts describe cea-runtime@dnadata.iam.gserviceaccount.com --format="value(email)"
```

### 2. Permisos de Cloud Build

La cuenta `[PROJECT_NUMBER]-compute@developer.gserviceaccount.com` (la que Cloud Build usa
por defecto al desplegar a Cloud Run) necesita permiso de:

```bash
PROJECT_ID=dnadata
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Necesario para que Cloud Build despliegue a Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CB_SA" --role="roles/run.admin" --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CB_SA" --role="roles/iam.serviceAccountUser" --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CB_SA" --role="roles/cloudbuild.builds.builder" --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CB_SA" --role="roles/artifactregistry.writer" --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$CB_SA" --role="roles/storage.admin" --condition=None
```

## Deploy

Desde Cloud Shell, parado en la raíz del repo:

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

El script imprime al final las URLs de backend y frontend.

## Estructura de los servicios desplegados

| Servicio | Tipo | Imagen | Notas |
|---|---|---|---|
| `cea-backend` | Cloud Run | `cloud-run-source-deploy/cea-backend` | Conecta a Cloud SQL vía Unix socket. STORAGE_BACKEND=gcs. Auth con secretos. |
| `cea-frontend` | Cloud Run | `cea/frontend:latest` | nginx servirá los estáticos del build de Vite. URL del backend inyectada en build con `VITE_API_URL`. |

## Variables de entorno

Backend (`cea-backend`):

| Var | Origen | Notas |
|---|---|---|
| `ENV` | env | `production` |
| `STORAGE_BACKEND` | env | `gcs` |
| `GCS_BUCKET` | env | `cea-uploads-dnadata` |
| `JWT_SECRET_KEY` | secret | `cea-jwt-secret:latest` |
| `JWT_ALGORITHM` | env | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | env | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | env | `30` |
| `DB_USER` | env | `postgres` |
| `DB_NAME` | env | `cea` |
| `DB_PASSWORD` | secret | `cea-db-password:latest` |
| `CLOUD_SQL_CONNECTION_NAME` | env | `dnadata:europe-west1:cea-db` |
| `CORS_ORIGINS` | env | URL del frontend (se actualiza al final del deploy) |

## Re-deploy

Cualquier cambio en `backend/` o `frontend/`: vuelve a correr `./deploy/deploy.sh`.

Cambios solo en variables de entorno o secretos: usa `gcloud run services update`.

## Coste mensual estimado

| Recurso | Coste |
|---|---|
| Cloud SQL Postgres `db-g1-small` (1 vCPU, 1.7GB, 10GB SSD) | ~28 € |
| Cloud Run backend (low traffic) | ~1 € |
| Cloud Run frontend (low traffic) | <1 € |
| Cloud Storage 10GB | <1 € |
| Egress a internet (con uso normal) | <1 € |
| **Total** | **~30 €/mes** |
