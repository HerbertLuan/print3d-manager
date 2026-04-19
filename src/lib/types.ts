import { Timestamp } from "firebase/firestore";

// =====================================================
// FILAMENT TYPES (Estoque de Bobinas Físicas)
// =====================================================

export interface Filament {
  id: string;
  name: string;
  color_name: string;
  color_hex?: string;
  material: string;
  initial_weight_grams: number;
  consumed_weight_grams: number; // default 0
  cost_brl: number;
  created_at: Timestamp;
}

export type NewFilament = Omit<Filament, "id">;

// =====================================================
// CATALOG TYPES
// =====================================================

export interface CatalogFilamentRequirement {
  material: string;
  weight_grams: number;
  color?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  
  // Campos legados mantidos para compatibilidade
  material?: string;
  weight_grams?: number;
  
  // Novo modelo dinâmico
  required_filaments?: CatalogFilamentRequirement[];
  
  time_minutes: number;
  calculated_price: number;
  imageUrl?: string;
  created_at: Timestamp;
}

export type NewCatalogItem = Omit<CatalogItem, "id">;

// =====================================================
// INVENTORY TYPES (peças impressas para pronta entrega)
// =====================================================

export interface InventoryItem {
  id: string;
  catalog_item_id: string;
  catalog_item_name: string;
  material: string;
  quantity_available: number;
  total_cost: number;
  total_price: number;
  created_at: Timestamp;
}

export type NewInventoryItem = Omit<InventoryItem, "id">;

// =====================================================
// SUPPLY TYPES (insumos não impressos: chaveiros, tags NFC, etc.)
// =====================================================

export interface Supply {
  id: string;
  name: string;
  quantity_purchased: number;   // Quantidade comprada no lote
  total_paid: number;           // Valor total pago pelo lote
  unit_cost: number;            // Calculado: total_paid / quantity_purchased
  quantity_in_stock: number;    // Estoque disponível atual
  imageUrl?: string;            // Foto do insumo
  created_at: Timestamp;
}

export type NewSupply = Omit<Supply, "id">;

export interface SelectedSupply {
  supplyId: string;
  name: string;
  unit_cost: number;
  quantity: number;
}

// =====================================================
// EXPENSE TYPES
// =====================================================

export interface Expense {
  id: string;
  description: string;
  value: number;
  date: string; // ISO string "YYYY-MM-DD"
  created_at: Timestamp;
}

export type NewExpense = Omit<Expense, "id">;

// =====================================================
// ORDER TYPES
// =====================================================

export type PaymentStatus = "Pendente" | "Pago";
export type ProductionStatus = "Na Fila" | "Imprimindo" | "Concluído";

export interface SelectedFilamentUsage {
  filament_id: string;
  weight_grams: number;
}

export interface Order {
  id: string;
  instagram_handle: string;
  catalog_item_id: string;
  piece_name: string;
  material: string; // Mantido para referência rápida/legado
  price: number;           // Preço de venda total (editável)
  quantity?: number;
  
  // Quebra de Custos
  base_cost?: number;      // Custo total anterior (legado)
  machine_cost?: number;   // Apenas máquina
  filament_cost?: number;  // Apenas filamento
  supplies_cost?: number;  // Insumos extras
  
  batch_time_minutes?: number; // Tempo de lote otimizado
  custo_operacional_total?: number; // filamento + máquina + insumos (salvo no momento do pedido)
  supplies?: SelectedSupply[]; // Insumos vinculados
  used_filaments?: SelectedFilamentUsage[]; // Rastreamento de bobinas físicas
  filaments_deducted?: boolean; // Se o peso das bobinas já foi descontado
  
  assigned_from_inventory?: boolean;
  payment_status: PaymentStatus;
  production_status: ProductionStatus;
  created_at: Timestamp;
}

export type NewOrder = Omit<Order, "id">;

// =====================================================
// UI FORM TYPES
// =====================================================

export interface CalculatorFormData {
  // Legacy
  weightGrams: string;
  material: string;
  
  // New Array
  required_filaments: { id: string; material: string; weight: string; color: string }[];
  
  timeHours: string;
  timeMinutes: string;
  profitMarginPercent: string;
}
