"""Configuración global vía variables de entorno (Pydantic Settings)."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Base de datos ─────────────────────────────────────────────
    # En local se setea DATABASE_URL completo (con password embebido).
    # En Cloud Run se setean los componentes por separado: la password
    # viene del Secret Manager y la URL se compone en código (Unix socket
    # vía Cloud SQL Auth Proxy).
    database_url: str = Field("", alias="DATABASE_URL")
    db_user: str = Field("", alias="DB_USER")
    db_password: str = Field("", alias="DB_PASSWORD")
    db_name: str = Field("", alias="DB_NAME")
    cloud_sql_connection_name: str = Field("", alias="CLOUD_SQL_CONNECTION_NAME")

    @property
    def effective_database_url(self) -> str:
        """URL final, ya con password aplicado.

        Prioridad:
        1. DATABASE_URL completa (modo local con .env).
        2. Componentes (modo Cloud Run con secret + connection name).
        """
        if self.database_url:
            return self.database_url
        if self.cloud_sql_connection_name and self.db_user and self.db_password:
            return (
                f"postgresql+psycopg://{self.db_user}:{self.db_password}"
                f"@/{self.db_name or 'cea'}"
                f"?host=/cloudsql/{self.cloud_sql_connection_name}"
            )
        raise RuntimeError(
            "Configuración de BD incompleta: falta DATABASE_URL o "
            "(CLOUD_SQL_CONNECTION_NAME + DB_USER + DB_PASSWORD)"
        )

    # JWT
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(30, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    # CORS
    cors_origins: str = Field(
        "http://localhost:5173,http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    # Entorno
    env: str = Field("development", alias="ENV")

    # Almacenamiento de attachments
    # storage_backend: 'local' (dev, escribe a UPLOAD_DIR) | 'gcs' (prod, escribe a GCS_BUCKET)
    storage_backend: str = Field("local", alias="STORAGE_BACKEND")
    upload_dir: str = Field("uploads", alias="UPLOAD_DIR")
    upload_max_mb: int = Field(50, alias="UPLOAD_MAX_MB")
    # GCS (solo si storage_backend = 'gcs')
    gcs_bucket: str = Field("", alias="GCS_BUCKET")
    # Tiempo de validez de las signed URLs para fotos privadas (segundos)
    gcs_signed_url_expires: int = Field(3600, alias="GCS_SIGNED_URL_EXPIRES")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.env.lower() in ("development", "dev", "local")


@lru_cache
def get_settings() -> Settings:
    return Settings()
