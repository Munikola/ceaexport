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
  | 'colors'
  | 'flavors'
  | 'intensities'
  | 'odors'
  | 'defects'
  | 'decisions'
  | 'cc-classifications'

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

// ── Análisis de calidad (R-CC-001) ────────────────────────────────────

export type SampleState = 'crudo' | 'cocido'
export type AnalysisStatus = 'borrador' | 'en_revision' | 'validado' | 'rechazado'

export interface PendingAnalysisRow {
  lot_id: number
  lot_code: string
  lot_year: number
  supplier_name: string | null
  origin_name: string | null
  psc: string | null
  product_type: string | null
  total_lbs: number | null
  reception_date: string | null
  arrival_time: string | null
  planta: string | null
  plant_id: number | null
  hours_since_reception: number | null
}

export type BoardState = 'pendiente' | 'en_analisis' | 'liberado' | 'rechazado'

export interface LotBoardRow {
  lot_id: number
  lot_code: string
  lot_year: number
  supplier_name: string | null
  origin_name: string | null
  psc: string | null
  product_type: string | null
  total_lbs: number | null
  reception_date: string | null
  arrival_time: string | null
  planta: string | null
  plant_id: number | null
  hours_since_reception: number | null
  analysis_id: number | null
  analysis_status: string | null
  analysis_date: string | null
  analyst_id: number | null
  analyst_name: string | null
  decision_name: string | null
  attachment_count: number
  board_state: BoardState | string
}

export interface LotReceptionInfo {
  reception_id: number
  reception_date: string
  arrival_time: string | null
  delivery_index: number
  plate_number: string | null
  driver_name: string | null
  logistics_name: string | null
  arrival_temperature: number | null
  received_lbs: number | null
  boxes_count: number | null
  bins_count: number | null
  plant_name: string | null
  remission_guide_number: string | null
  warranty_letter_number: string | null
  truck_condition: string | null
  ice_condition: string | null
  hygiene_condition: string | null
  observations: string | null
}

export interface AttachmentRead {
  attachment_id: number
  attachment_type_id: number
  type_code: string | null
  type_name: string | null
  lot_id: number
  reception_id: number | null
  analysis_id: number | null
  file_url: string
  file_name: string | null
  mime_type: string | null
  file_size_bytes: number | null
  comment: string | null
  uploaded_by: number | null
  uploaded_by_name: string | null
  uploaded_at: string
}

export interface LotContext {
  lot_id: number
  lot_code: string
  lot_year: number
  plant_id: number | null
  plant_name: string | null
  supplier_name: string | null
  origin_name: string | null
  psc: string | null
  product_type: string | null
  chemical_name: string | null
  treaters: string[]
  fishing_date: string | null
  total_lbs: number | null
  receptions: LotReceptionInfo[]
}

export interface SamplingDefectIO {
  defect_id: number
  units_count?: number | null
  percentage?: number | null
}

export interface SamplingIO {
  sampling_index: 1 | 2 | 3
  units_count?: number | null
  defect_units?: number | null
  good_units?: number | null
  defect_percentage?: number | null
  good_percentage?: number | null
  so2_ppm?: number | null
  defects: SamplingDefectIO[]
}

export interface ColorIO {
  sample_state: SampleState
  color_id?: number | null
}

export interface FlavorIO {
  sample_state: SampleState
  flavor_id: number
  intensity_id?: number | null
  percentage?: number | null
}

export interface OdorIO {
  sample_state: SampleState
  odor_id: number
  intensity_id?: number | null
  presence: boolean
  observations?: string | null
}

export interface SizeDistributionIO {
  cc_classification_id: number
  weight_grams?: number | null
  units_count?: number | null
  average_grammage?: number | null
}

export interface AnalysisUpsert {
  plant_id: number
  analysis_date: string // YYYY-MM-DD
  analysis_time?: string | null
  shift?: string | null
  analyst_id?: number | null

  sample_total_weight?: number | null
  total_units?: number | null
  global_grammage?: number | null
  so2_residual_ppm?: number | null
  so2_global?: number | null
  average_grammage?: number | null
  average_classification_code?: string | null
  product_temperature?: number | null

  gr_cc?: number | null
  c_kg?: number | null
  gr_sc?: number | null
  c_kg2?: number | null

  decision_id?: number | null
  destined_product_type?: ProductType | null
  global_defect_percentage?: number | null
  good_product_percentage?: number | null
  general_observations?: string | null
  status: AnalysisStatus

  lot_ids: number[]
  samplings: SamplingIO[]
  colors: ColorIO[]
  flavors: FlavorIO[]
  odors: OdorIO[]
  size_distribution: SizeDistributionIO[]
}

export interface AnalysisLotInfo {
  lot_id: number
  lot_code: string
  lot_year: number
  supplier_name: string | null
  origin_name: string | null
  psc: string | null
  product_type: string | null
  total_lbs: number | null
  contribution_lbs: number | null
}

export interface AnalysisRead extends AnalysisUpsert {
  analysis_id: number
  created_at: string
  updated_at: string
  lots: AnalysisLotInfo[]
  samplings: (SamplingIO & { sampling_id: number; defects: (SamplingDefectIO & { sampling_defect_id: number })[] })[]
  colors: (ColorIO & { analysis_color_id: number })[]
  flavors: (FlavorIO & { analysis_flavor_id: number })[]
  odors: (OdorIO & { analysis_odor_id: number })[]
  size_distribution: (SizeDistributionIO & { distribution_id: number })[]
}
