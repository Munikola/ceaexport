"""Entry point de la API FastAPI."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import admin, analyses, attachments, auth, catalogs, public, receptions
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    # Aquí en el futuro: warmup de catálogos, conexión a storage, etc.
    yield


app = FastAPI(
    title="CEA EXPORT — Control de Calidad",
    description="API para registro de recepciones, lotes, análisis e histogramas de camarón.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok", "env": settings.env}


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "CEA EXPORT — Control de Calidad",
        "version": "0.1.0",
        "docs": "/docs",
    }


app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(catalogs.router, prefix="/api")
app.include_router(receptions.router, prefix="/api")
app.include_router(analyses.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")

# Servir ficheros subidos (uploads/<lot_id>/<uuid>.<ext>) como estático
_uploads = Path(settings.upload_dir).resolve()
_uploads.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads)), name="uploads")

# TODO siguientes routers:
# from app.api import lots, histograms
# app.include_router(histograms.router, prefix="/api/histograms", tags=["histograms"])
