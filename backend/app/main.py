"""Entry point de la API FastAPI."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, public
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

# TODO siguientes routers:
# from app.api import receptions, lots, analyses, histograms
# app.include_router(receptions.router, prefix="/api/receptions", tags=["receptions"])
# app.include_router(lots.router, prefix="/api/lots", tags=["lots"])
# app.include_router(analyses.router, prefix="/api/analyses", tags=["analyses"])
# app.include_router(histograms.router, prefix="/api/histograms", tags=["histograms"])
