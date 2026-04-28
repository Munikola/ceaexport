"""Modelos ORM operacionales: recepciones y lotes."""
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    Time,
)


# Postgres ENUM types ya creados por db/schema.sql. `create_type=False` evita
# que SQLAlchemy intente recrearlos.
PRODUCT_TYPE_ENUM = SAEnum("ENTERO", "COLA", name="product_type", create_type=False)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.catalogs import (
    Chemical,
    Driver,
    LogisticsCompany,
    LotCategory,
    Origin,
    Plant,
    Pond,
    Supplier,
    Treater,
    Truck,
)


# ── Tabla puente M:N lote ↔ tratador (sin columnas extra → Table directo) ──
lot_treaters_table = Table(
    "lot_treaters",
    Base.metadata,
    Column("lot_id", Integer, ForeignKey("lots.lot_id", ondelete="CASCADE"), primary_key=True),
    Column("treater_id", Integer, ForeignKey("treaters.treater_id"), primary_key=True),
)


class Lot(Base):
    __tablename__ = "lots"

    lot_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_code: Mapped[str] = mapped_column(String(50), nullable=False)
    lot_year: Mapped[int] = mapped_column(Integer, nullable=False)
    client_lot_code: Mapped[str | None] = mapped_column(String(50))
    qr_code: Mapped[str | None] = mapped_column(UUID(as_uuid=False))

    plant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("plants.plant_id"))
    supplier_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("suppliers.supplier_id"))
    origin_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("origins.origin_id"))
    pond_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("ponds.pond_id"))
    lot_category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("lot_categories.lot_category_id")
    )

    product_type: Mapped[str | None] = mapped_column(PRODUCT_TYPE_ENUM)
    fishing_date: Mapped[date | None] = mapped_column(Date)
    chemical_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("chemicals.chemical_id"))
    observations: Mapped[str | None] = mapped_column(Text)

    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones para serialización
    plant: Mapped[Plant | None] = relationship(lazy="joined")
    supplier: Mapped[Supplier | None] = relationship(lazy="joined")
    origin: Mapped[Origin | None] = relationship(lazy="joined")
    pond: Mapped[Pond | None] = relationship(lazy="joined")
    lot_category: Mapped[LotCategory | None] = relationship(lazy="joined")
    chemical: Mapped[Chemical | None] = relationship(lazy="joined")
    treaters: Mapped[list[Treater]] = relationship(
        secondary=lot_treaters_table, lazy="selectin"
    )


class Reception(Base):
    __tablename__ = "receptions"

    reception_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plant_id: Mapped[int] = mapped_column(Integer, ForeignKey("plants.plant_id"), nullable=False)
    truck_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("trucks.truck_id"))
    driver_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("drivers.driver_id"))
    logistics_company_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("logistics_companies.logistics_company_id")
    )

    reception_date: Mapped[date] = mapped_column(Date, nullable=False)
    arrival_time: Mapped[time | None] = mapped_column(Time)
    unloading_start_time: Mapped[time | None] = mapped_column(Time)
    unloading_end_time: Mapped[time | None] = mapped_column(Time)

    remission_guide_number: Mapped[str | None] = mapped_column(String(100))
    sri_access_key: Mapped[str | None] = mapped_column(String(49))
    warranty_letter_number: Mapped[str | None] = mapped_column(String(100))
    arrival_temperature: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    truck_condition_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("condition_levels.condition_id")
    )
    ice_condition_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("condition_levels.condition_id")
    )
    hygiene_condition_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("condition_levels.condition_id")
    )

    observations: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relaciones
    plant: Mapped[Plant] = relationship(lazy="joined")
    truck: Mapped[Truck | None] = relationship(lazy="joined")
    driver: Mapped[Driver | None] = relationship(lazy="joined")
    logistics_company: Mapped[LogisticsCompany | None] = relationship(lazy="joined")
    reception_lots: Mapped[list["ReceptionLot"]] = relationship(
        back_populates="reception", lazy="selectin", cascade="all, delete-orphan"
    )


class ReceptionLot(Base):
    """Junction reception ↔ lot. Permite multi-lote por camión y multi-camión por lote."""
    __tablename__ = "reception_lots"

    reception_lot_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reception_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("receptions.reception_id", ondelete="CASCADE")
    )
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("lots.lot_id", ondelete="CASCADE")
    )
    sequence_in_reception: Mapped[int | None] = mapped_column(Integer)
    delivery_index: Mapped[int] = mapped_column(Integer, default=1)
    received_lbs: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    boxes_count: Mapped[int | None] = mapped_column(Integer)
    bins_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    reception: Mapped[Reception] = relationship(back_populates="reception_lots")
    lot: Mapped[Lot] = relationship(lazy="joined")
