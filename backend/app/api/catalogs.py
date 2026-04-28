"""Endpoints de catálogos.

Diseño: una ruta uniforme por catálogo. La UI llama a `/api/catalogs/{name}`
para obtener el listado de cualquier catálogo en formato `{id, name, extra}`.

Crear nuevos valores se hace con `POST /api/catalogs/{name}` (cuando el
catálogo lo permite).
"""
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import CurrentUser
from app.models.auth import Role
from app.models.catalogs import (
    CcClassification,
    Chemical,
    Color,
    ConditionLevel,
    Decision,
    Defect,
    Driver,
    Flavor,
    Intensity,
    LogisticsCompany,
    LotCategory,
    Odor,
    Origin,
    Plant,
    Pond,
    Supplier,
    SupplyType,
    Treater,
    Truck,
)

router = APIRouter(prefix="/catalogs", tags=["catalogs"])


# ── Mapeo catálogo → modelo + columnas (id, name) + créables ─────────

class CatalogConfig:
    def __init__(
        self,
        model: type,
        id_col: str,
        name_col: str,
        extra_cols: list[str] | None = None,
        creatable: bool = False,
        type_filter: str | None = None,  # para condition_levels
    ):
        self.model = model
        self.id_col = id_col
        self.name_col = name_col
        self.extra_cols = extra_cols or []
        self.creatable = creatable
        self.type_filter = type_filter


CATALOGS: dict[str, CatalogConfig] = {
    "plants": CatalogConfig(Plant, "plant_id", "plant_name", ["plant_code", "location"]),
    "suppliers": CatalogConfig(Supplier, "supplier_id", "supplier_name",
                                ["tax_id", "contact_name", "phone", "email"], creatable=True),
    "origins": CatalogConfig(Origin, "origin_id", "origin_name", ["region"], creatable=True),
    "ponds": CatalogConfig(Pond, "pond_id", "pond_code",
                            ["supplier_id", "origin_id"], creatable=True),
    "logistics-companies": CatalogConfig(LogisticsCompany, "logistics_company_id", "company_name",
                                          ["tax_id"], creatable=True),
    "trucks": CatalogConfig(Truck, "truck_id", "plate_number",
                             ["logistics_company_id"], creatable=True),
    "drivers": CatalogConfig(Driver, "driver_id", "full_name",
                              ["document_id", "phone"], creatable=True),
    "treaters": CatalogConfig(Treater, "treater_id", "full_name",
                               ["is_proveedor"], creatable=True),
    "chemicals": CatalogConfig(Chemical, "chemical_id", "chemical_name", creatable=True),
    "lot-categories": CatalogConfig(LotCategory, "lot_category_id", "category_name",
                                     ["category_code", "requires_full_analysis"]),
    "supply-types": CatalogConfig(SupplyType, "supply_type_id", "supply_name",
                                   ["supply_code", "default_unit"]),
    "roles": CatalogConfig(Role, "role_id", "role_name", ["role_code"]),
    # Condition levels: 3 sub-catálogos virtuales según `condition_type`.
    "condition-levels-truck": CatalogConfig(ConditionLevel, "condition_id", "condition_name",
                                             ["condition_code"], type_filter="truck"),
    "condition-levels-ice": CatalogConfig(ConditionLevel, "condition_id", "condition_name",
                                           ["condition_code"], type_filter="ice"),
    "condition-levels-hygiene": CatalogConfig(ConditionLevel, "condition_id", "condition_name",
                                               ["condition_code"], type_filter="hygiene"),
    # ── Catálogos analíticos (R-CC-001) — read-only, definidos por calidad ──
    "colors": CatalogConfig(Color, "color_id", "color_name",
                             ["color_code", "color_grade", "color_modifier", "sort_order"]),
    "flavors": CatalogConfig(Flavor, "flavor_id", "flavor_name", ["is_default"]),
    "intensities": CatalogConfig(Intensity, "intensity_id", "intensity_name",
                                  ["intensity_code", "sort_order"]),
    "odors": CatalogConfig(Odor, "odor_id", "odor_name", ["is_default"]),
    "defects": CatalogConfig(Defect, "defect_id", "defect_name",
                              ["defect_code", "defect_category", "in_paper_form", "sort_order"]),
    "decisions": CatalogConfig(Decision, "decision_id", "decision_name",
                                ["decision_code", "is_approval", "is_rejection",
                                 "requires_action", "sort_order"]),
    "cc-classifications": CatalogConfig(CcClassification, "cc_classification_id", "range_code",
                                         ["min_count", "max_count", "sort_order"]),
}


def _serialize(obj: Any, cfg: CatalogConfig) -> dict:
    extra = {col: getattr(obj, col, None) for col in cfg.extra_cols}
    return {
        "id": getattr(obj, cfg.id_col),
        "name": getattr(obj, cfg.name_col),
        "active": bool(getattr(obj, "active", True)),
        "extra": extra,
    }


@router.get("/{catalog_name}")
def list_catalog(
    catalog_name: str,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    only_active: bool = True,
) -> list[dict]:
    cfg = CATALOGS.get(catalog_name)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Catálogo '{catalog_name}' no existe")

    query = select(cfg.model)
    if only_active and hasattr(cfg.model, "active"):
        query = query.where(cfg.model.active.is_(True))
    if cfg.type_filter and hasattr(cfg.model, "condition_type"):
        query = query.where(cfg.model.condition_type == cfg.type_filter)

    name_attr = getattr(cfg.model, cfg.name_col)
    query = query.order_by(name_attr)

    items = db.execute(query).scalars().all()
    return [_serialize(item, cfg) for item in items]


# ── Creación dinámica (para "+ añadir" desde dropdowns) ──────────────

class GenericCatalogCreate(BaseModel):
    name: str
    extra: dict = {}


@router.post("/{catalog_name}", status_code=201)
def create_catalog_item(
    catalog_name: str,
    payload: GenericCatalogCreate,
    _user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    cfg = CATALOGS.get(catalog_name)
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Catálogo '{catalog_name}' no existe")
    if not cfg.creatable:
        raise HTTPException(status_code=403, detail=f"Catálogo '{catalog_name}' no es editable desde la app")

    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Nombre vacío")

    # Construir kwargs respetando solo columnas válidas del modelo
    kwargs = {cfg.name_col: payload.name.strip()}
    for col, val in payload.extra.items():
        if hasattr(cfg.model, col) and val is not None:
            kwargs[col] = val

    obj = cfg.model(**kwargs)
    db.add(obj)
    try:
        db.commit()
        db.refresh(obj)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo crear: {e}") from e

    return _serialize(obj, cfg)
