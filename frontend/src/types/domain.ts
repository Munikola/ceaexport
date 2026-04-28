// ── Catálogos ─────────────────────────────────────────────────────────

export interface CatalogItem {
  id: number
  name: string
  active: boolean
  extra: Record<string, unknown>
}

export type CatalogName =
  | 'plants'
  | 'suppliers'
  | 'origins'
  | 'ponds'
  | 'logistics-companies'
  | 'trucks'
  | 'drivers'
  | 'treaters'
  | 'chemicals'
  | 'lot-categories'
  | 'supply-types'
  | 'roles'
  | 'condition-levels-truck'
  | 'condition-levels-ice'
  | 'condition-levels-hygiene'

// ── Operaciones ───────────────────────────────────────────────────────

export type ProductType = 'ENTERO' | 'COLA'

export interface LotInReceptionCreate {
  lot_code: string
  client_lot_code?: string | null
  lot_year?: number | null
  lot_category_id?: number | null
  supplier_id: number
  origin_id?: number | null
  pond_id?: number | null
  product_type: ProductType
  fishing_date?: string | null
  chemical_id?: number | null
  treater_ids: number[]
  observations?: string | null
  received_lbs?: number | null
  boxes_count?: number | null
  bins_count?: number | null
  delivery_index?: number
}

export interface ReceptionCreate {
  plant_id: number
  truck_id?: number | null
  driver_id?: number | null
  logistics_company_id?: number | null
  reception_date: string // YYYY-MM-DD
  arrival_time?: string | null // HH:MM:SS
  remission_guide_number?: string | null
  sri_access_key?: string | null
  warranty_letter_number?: string | null
  arrival_temperature?: number | null
  truck_condition_id?: number | null
  ice_condition_id?: number | null
  hygiene_condition_id?: number | null
  observations?: string | null
  lots: LotInReceptionCreate[]
}

export interface ReceptionLotRead {
  reception_lot_id: number
  lot_id: number
  delivery_index: number
  received_lbs: number | null
  boxes_count: number | null
  bins_count: number | null
  lot: {
    lot_id: number
    lot_code: string
    lot_year: number
    supplier_id: number | null
    pond_id: number | null
    product_type: string | null
  }
}

export interface ReceptionRead {
  reception_id: number
  plant_id: number
  truck_id: number | null
  driver_id: number | null
  logistics_company_id: number | null
  reception_date: string
  arrival_time: string | null
  remission_guide_number: string | null
  sri_access_key: string | null
  arrival_temperature: number | null
  observations: string | null
  created_at: string
  reception_lots: ReceptionLotRead[]
}
