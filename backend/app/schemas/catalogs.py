"""Schemas Pydantic para catálogos (lectura y creación)."""
from pydantic import BaseModel, ConfigDict


# Cada catálogo se serializa con dos campos uniformes (`id` y `name`) además
# de los suyos propios. La UI solo necesita id+name para los dropdowns; los
# campos extra los usa la admin / detalle.

class CatalogItem(BaseModel):
    """Forma común que la UI usa en todos los selects."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    active: bool = True
    extra: dict = {}


# ── Schemas específicos por catálogo (lectura completa) ──────────────

class PlantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plant_id: int
    plant_code: str
    plant_name: str
    location: str | None
    active: bool


class SupplierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_id: int
    supplier_name: str
    tax_id: str | None
    contact_name: str | None
    phone: str | None
    email: str | None
    active: bool


class SupplierCreate(BaseModel):
    supplier_name: str
    tax_id: str | None = None
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None


class OriginRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    origin_id: int
    origin_name: str
    region: str | None
    active: bool


class OriginCreate(BaseModel):
    origin_name: str
    region: str | None = None


class PondRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pond_id: int
    pond_code: str
    supplier_id: int | None
    origin_id: int | None
    active: bool


class PondCreate(BaseModel):
    pond_code: str
    supplier_id: int | None = None
    origin_id: int | None = None


class LogisticsCompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    logistics_company_id: int
    company_name: str
    tax_id: str | None
    active: bool


class LogisticsCompanyCreate(BaseModel):
    company_name: str
    tax_id: str | None = None


class TruckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    truck_id: int
    plate_number: str
    logistics_company_id: int | None
    active: bool


class TruckCreate(BaseModel):
    plate_number: str
    logistics_company_id: int | None = None


class DriverRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    driver_id: int
    full_name: str
    document_id: str | None
    phone: str | None
    active: bool


class DriverCreate(BaseModel):
    full_name: str
    document_id: str | None = None
    phone: str | None = None


class TreaterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    treater_id: int
    full_name: str
    is_proveedor: bool
    active: bool


class TreaterCreate(BaseModel):
    full_name: str
    is_proveedor: bool = False


class ChemicalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    chemical_id: int
    chemical_name: str
    active: bool


class ChemicalCreate(BaseModel):
    chemical_name: str


class LotCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lot_category_id: int
    category_code: str
    category_name: str
    requires_full_analysis: bool
    active: bool


class ConditionLevelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    condition_id: int
    condition_type: str
    condition_code: str
    condition_name: str
    sort_order: int | None
    active: bool


class SupplyTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supply_type_id: int
    supply_code: str
    supply_name: str
    default_unit: str | None
    active: bool
