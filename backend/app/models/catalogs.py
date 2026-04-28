"""Modelos ORM de catálogos. Mapean a las tablas creadas en `db/schema.sql`."""
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Plant(Base):
    __tablename__ = "plants"

    plant_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    plant_name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(150))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(50))
    contact_name: Mapped[str | None] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(150))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Origin(Base):
    __tablename__ = "origins"

    origin_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    origin_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    region: Mapped[str | None] = mapped_column(String(150))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Pond(Base):
    __tablename__ = "ponds"

    pond_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pond_code: Mapped[str] = mapped_column(String(50), nullable=False)
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.supplier_id"))
    origin_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("origins.origin_id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class LogisticsCompany(Base):
    __tablename__ = "logistics_companies"

    logistics_company_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Truck(Base):
    __tablename__ = "trucks"

    truck_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plate_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    logistics_company_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("logistics_companies.logistics_company_id")
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Driver(Base):
    __tablename__ = "drivers"

    driver_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    document_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    phone: Mapped[str | None] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Treater(Base):
    __tablename__ = "treaters"

    treater_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    is_proveedor: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Chemical(Base):
    __tablename__ = "chemicals"

    chemical_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chemical_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class LotCategory(Base):
    __tablename__ = "lot_categories"

    lot_category_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category_name: Mapped[str] = mapped_column(String(100), nullable=False)
    requires_full_analysis: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ConditionLevel(Base):
    __tablename__ = "condition_levels"

    condition_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    condition_type: Mapped[str] = mapped_column(String(50), nullable=False)
    condition_code: Mapped[str] = mapped_column(String(50), nullable=False)
    condition_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int | None] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SupplyType(Base):
    __tablename__ = "supply_types"

    supply_type_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supply_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    supply_name: Mapped[str] = mapped_column(String(100), nullable=False)
    default_unit: Mapped[str | None] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
