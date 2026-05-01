#!/usr/bin/env bash
# Build & deploy de backend + frontend a Cloud Run.
# Lanzar desde Cloud Shell, parado en la raíz del repo.
#
# Variables esperadas (con defaults):
#   PROJECT_ID          (default: dnadata)
#   REGION              (default: europe-west1)
#   CLOUD_SQL_INSTANCE  (default: cea-db)
#   GCS_BUCKET          (default: cea-uploads-dnadata)
#   SERVICE_ACCOUNT     (default: cea-runtime@${PROJECT_ID}.iam.gserviceaccount.com)
#   BACKEND_SERVICE     (default: cea-backend)
#   FRONTEND_SERVICE    (default: cea-frontend)
#   AR_REPO             (default: cea)

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-dnadata}"
REGION="${REGION:-europe-west1}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-cea-db}"
GCS_BUCKET="${GCS_BUCKET:-cea-uploads-dnadata}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-cea-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
BACKEND_SERVICE="${BACKEND_SERVICE:-cea-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-cea-frontend}"
AR_REPO="${AR_REPO:-cea}"

CONNECTION_NAME="${PROJECT_ID}:${REGION}:${CLOUD_SQL_INSTANCE}"
AR_HOST="${REGION}-docker.pkg.dev"

echo "════════════════════════════════════════════════════════"
echo " CEA Export — Deploy a Cloud Run"
echo "════════════════════════════════════════════════════════"
echo " Project:      $PROJECT_ID"
echo " Region:       $REGION"
echo " Cloud SQL:    $CONNECTION_NAME"
echo " Bucket:       gs://$GCS_BUCKET"
echo " Service acc.: $SERVICE_ACCOUNT"
echo " AR Repo:      $AR_HOST/$PROJECT_ID/$AR_REPO"
echo "════════════════════════════════════════════════════════"

gcloud config set project "$PROJECT_ID" > /dev/null

# ────────────────────────────────────────────────────────
# 0. Repositorio Artifact Registry (idempotente)
# ────────────────────────────────────────────────────────
echo ""
echo "▶ Asegurando Artifact Registry repo..."
gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="CEA Export — imagenes de frontend/backend"

# ────────────────────────────────────────────────────────
# 1. Backend — build & deploy desde Dockerfile
# ────────────────────────────────────────────────────────
echo ""
echo "▶ Backend: build & deploy"
gcloud run deploy "$BACKEND_SERVICE" \
    --source backend \
    --region "$REGION" \
    --service-account "$SERVICE_ACCOUNT" \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --timeout 300 \
    --set-env-vars "ENV=production,STORAGE_BACKEND=gcs,GCS_BUCKET=$GCS_BUCKET,JWT_ALGORITHM=HS256,ACCESS_TOKEN_EXPIRE_MINUTES=60,REFRESH_TOKEN_EXPIRE_DAYS=30,DB_USER=postgres,DB_NAME=cea,CLOUD_SQL_CONNECTION_NAME=$CONNECTION_NAME" \
    --update-secrets "JWT_SECRET_KEY=cea-jwt-secret:latest,DB_PASSWORD=cea-db-password:latest"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format 'value(status.url)')
echo "  Backend URL: $BACKEND_URL"

# ────────────────────────────────────────────────────────
# 2. Frontend — build con Cloud Build (inyecta VITE_API_URL en bundle)
# ────────────────────────────────────────────────────────
echo ""
echo "▶ Frontend: build con Cloud Build"
gcloud builds submit \
    --config frontend/cloudbuild.yaml \
    --substitutions="_VITE_API_URL=${BACKEND_URL},_REGION=${REGION}" \
    frontend

echo ""
echo "▶ Frontend: deploy a Cloud Run"
gcloud run deploy "$FRONTEND_SERVICE" \
    --image "${AR_HOST}/${PROJECT_ID}/${AR_REPO}/frontend:latest" \
    --region "$REGION" \
    --allow-unauthenticated \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 3 \
    --timeout 60

FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format 'value(status.url)')
echo "  Frontend URL: $FRONTEND_URL"

# ────────────────────────────────────────────────────────
# 3. Actualizar CORS_ORIGINS del backend para aceptar al frontend
# ────────────────────────────────────────────────────────
echo ""
echo "▶ Backend: actualizar CORS para aceptar $FRONTEND_URL"
gcloud run services update "$BACKEND_SERVICE" \
    --region "$REGION" \
    --update-env-vars "CORS_ORIGINS=$FRONTEND_URL"

echo ""
echo "════════════════════════════════════════════════════════"
echo " ✓ Deploy completo"
echo "════════════════════════════════════════════════════════"
echo ""
echo " Backend:  $BACKEND_URL"
echo " Frontend: $FRONTEND_URL"
echo ""
echo " Login con admin@cea.com y la password local del bootstrap."
echo "════════════════════════════════════════════════════════"
