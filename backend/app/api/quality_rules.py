"""CRUD de reglas de calidad / alertas operativas (admin only).

Las reglas viven en la tabla `quality_rules` y son evaluadas por el endpoint
`/api/reports/dashboard/operational-alerts` para emitir alertas dinámicas en
el dashboard, sin necesidad de tocar código.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import CurrentUser

router = APIRouter(prefix="/quality-rules", tags=["quality-rules"])


# Métricas soportadas (el endpoint de alertas sabe cómo evaluarlas).
SUPPORTED_METRICS = {
    "global_defect_percentage": "% defectos global del lote",
    "so2_global": "SO₂ global del lote",
    "avg_so2_period": "SO₂ promedio del periodo",
    "avg_defect_pct_period": "% defectos promedio del periodo",
    "supplier_avg_defect_pct": "% defectos promedio del proveedor",
    "defect_pct": "% promedio de un defecto concreto",
    "rejected_pct": "% rechazos del periodo",
}

VALID_OPERATORS = {">", ">=", "<", "<=", "="}
VALID_SEVERITY = {"info", "warn", "critical"}


class RuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    rule_id: int
    rule_name: str
    metric: str
    operator: str
    threshold_value: float | None
    severity: str | None
    action_message: str | None
    active: bool


class RuleUpsert(BaseModel):
    rule_name: str = Field(..., min_length=1, max_length=150)
    metric: str = Field(..., min_length=1, max_length=100)
    operator: str = Field(..., min_length=1, max_length=5)
    threshold_value: float | None = None
    severity: str | None = Field(None, pattern="^(info|warn|critical)?$")
    action_message: str | None = None
    active: bool = True


def _ensure_admin(user) -> None:
    if not user.role or user.role.role_code != "admin":
        raise HTTPException(status_code=403, detail="Solo admin")


def _validate_payload(p: RuleUpsert) -> None:
    if p.metric not in SUPPORTED_METRICS:
        raise HTTPException(
            status_code=400,
            detail=f"Métrica '{p.metric}' no soportada. Disponibles: {list(SUPPORTED_METRICS.keys())}",
        )
    if p.operator not in VALID_OPERATORS:
        raise HTTPException(
            status_code=400,
            detail=f"Operador '{p.operator}' inválido. Disponibles: {sorted(VALID_OPERATORS)}",
        )


@router.get("", response_model=list[RuleRead])
def list_rules(
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    only_active: bool = False,
):
    sql = "SELECT rule_id, rule_name, metric, operator, threshold_value, severity, action_message, active FROM quality_rules"
    if only_active:
        sql += " WHERE active IS TRUE"
    sql += " ORDER BY rule_id"
    rows = db.execute(text(sql)).mappings().all()
    return [RuleRead(**dict(r)) for r in rows]


@router.get("/metrics")
def list_supported_metrics(_user: CurrentUser):
    """Para que la UI ofrezca un dropdown de métricas válidas."""
    return [{"code": k, "label": v} for k, v in SUPPORTED_METRICS.items()]


@router.post("", response_model=RuleRead, status_code=201)
def create_rule(
    payload: RuleUpsert,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    _ensure_admin(user)
    _validate_payload(payload)
    row = db.execute(
        text(
            """
            INSERT INTO quality_rules
                (rule_name, metric, operator, threshold_value, severity, action_message, active)
            VALUES (:rule_name, :metric, :operator, :threshold_value, :severity, :action_message, :active)
            RETURNING rule_id, rule_name, metric, operator, threshold_value, severity, action_message, active
            """
        ),
        payload.model_dump(),
    ).mappings().first()
    db.commit()
    return RuleRead(**dict(row)) if row else None


@router.patch("/{rule_id}", response_model=RuleRead)
def update_rule(
    rule_id: int,
    payload: RuleUpsert,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    _ensure_admin(user)
    _validate_payload(payload)
    row = db.execute(
        text(
            """
            UPDATE quality_rules SET
                rule_name = :rule_name,
                metric = :metric,
                operator = :operator,
                threshold_value = :threshold_value,
                severity = :severity,
                action_message = :action_message,
                active = :active
            WHERE rule_id = :rule_id
            RETURNING rule_id, rule_name, metric, operator, threshold_value, severity, action_message, active
            """
        ),
        {**payload.model_dump(), "rule_id": rule_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Regla no encontrada")
    db.commit()
    return RuleRead(**dict(row))


@router.delete("/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    _ensure_admin(user)
    db.execute(text("DELETE FROM quality_rules WHERE rule_id = :id"), {"id": rule_id})
    db.commit()
    return None
