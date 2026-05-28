import { Timestamp } from "firebase/firestore";

// =====================================================
// PARTNER TYPES (Sistema de Parceiros / Afiliados)
// =====================================================

export interface Partner {
  id: string;
  /** Nome completo do parceiro */
  name: string;
  /** E-mail usado para login no portal do parceiro */
  email: string;
  /** Percentual de comissão sobre o lucro bruto (ex: 10 → 10%) */
  commission_percentage: number;
  /** Chave PIX para facilitar o pagamento */
  pix_key?: string;
  /** Se false, não aparece na lista de seleção dos pedidos */
  active: boolean;
  created_at: Timestamp;
}

export type NewPartner = Omit<Partner, "id">;

// =====================================================
// PROMOTIONS TYPES (Cupons e Configurações da Loja)
// =====================================================

export type CouponType = "percentage" | "fixed" | "gift";

export interface Coupon {
  id: string;
  /** Código do cupom em maiúsculas (ex: "EVINS10") */
  code: string;
  type: CouponType;
  /** Valor do desconto: percentual (0-100) ou fixo em R$. Zero para tipo 'gift'. */
  value: number;
  /** Valor mínimo de compra para o cupom ser aceito (R$) */
  min_purchase_value: number;
  /** Se false, o cupom não pode ser aplicado */
  active: boolean;
  created_at: Timestamp;
}

export type NewCoupon = Omit<Coupon, "id">;

export interface StoreSettings {
  /** Valor mínimo para o cliente ganhar um brinde (R$) */
  gift_threshold: number;
}

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

  // ── Campos de Marketing / Vitrine Pública ──────────────
  /** Exibir este item na loja pública */
  showInStore?: boolean;
  /** Nome comercial do produto para a vitrine */
  headline_venda?: string;
  /** Descrição curta focada em benefícios */
  descricao_venda?: string;
  /** Destaque na vitrine (aparece primeiro, badge especial) */
  destaque?: boolean;
  /** Preço de venda na loja pública (sopõe calculated_price na vitrine) */
  preco_venda_loja?: number;
  /** ID da Coleção (categoria) associada */
  collectionId?: string;
}

export type NewCatalogItem = Omit<CatalogItem, "id">;

// =====================================================
// COLLECTION TYPES (Categorias / Coleções)
// =====================================================

export interface Collection {
  id: string;
  /** Nome exibido na vitrine e no admin (ex: "Dia das Mães") */
  nome: string;
  /** Slug para URL (ex: "dia-das-maes") */
  slug: string;
  /** Ordem de exibição (menor = primeiro) */
  ordem: number;
  /** Se false, não aparece na vitrine nem no filtro */
  ativo: boolean;
  /** Exibe antes das demais com estilo diferenciado */
  em_destaque: boolean;
  created_at: Timestamp;
}

export type NewCollection = Omit<Collection, "id">;

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
  date: string; // ISO string "YYYY-MM-DD" (Data de Competência)
  categoria?: string;
  tipo_cobranca?: "Única" | "Fixa Mensal" | "Parcelada";
  parcelas?: string; // ex: "1/3"
  status?: "Pendente" | "Pago";
  paid_at?: string; // YYYY-MM-DD (Data de Pagamento para fluxo de caixa)
  created_at: Timestamp;
}

export type NewExpense = Omit<Expense, "id">;

export interface ExpenseCategory {
  id: string;
  name: string;
  created_at: Timestamp;
}

export type NewExpenseCategory = Omit<ExpenseCategory, "id">;

// =====================================================
// ORDER TYPES
// =====================================================

export type PaymentStatus = "Pendente" | "Pago";
export type ProductionStatus = "pending_approval" | "Na Fila" | "Imprimindo" | "Concluído";

export interface SelectedFilamentUsage {
  filament_id: string;
  weight_grams: number;
}

/**
 * Uma linha de produto dentro de um pedido multi-item.
 * Cada linha armazena os custos unitários calculados no momento da criação
 * para preservar o histórico mesmo se o catálogo mudar.
 */
export interface OrderLineItem {
  productId: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  custo_material_unitario: number;
  custo_maquina_unitario: number;
  /** Tempo de lote calculado (minutos) */
  batch_time_minutes?: number;
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
  /** Origem do pedido: 'admin' (painel) | 'site' (vitrine pública) */
  origem?: "admin" | "site";
  /** Nome do cliente */
  cliente_nome?: string;
  /** Telefone do cliente (pedidos vindos do site) */
  cliente_telefone?: string;
  /** Itens do carrinho (pedidos vindos do site — formato legado) */
  cart_items?: CartItem[];
  /** Linhas de produto do pedido multi-item (novo formato admin + site) */
  items?: OrderLineItem[];
  /** Código curto gerado no site para facilitar identificação (ex: A7F2) */
  shortCode?: string;
  payment_status: PaymentStatus;
  paid_at?: string; // Data de Pagamento para fluxo de caixa (YYYY-MM-DD)
  production_status: ProductionStatus;
  /** Código do cupom aplicado no pedido */
  coupon_code?: string;
  /** Valor total de desconto concedido (R$) */
  discount_amount?: number;
  /** ID do parceiro que indicou este pedido */
  partner_id?: string;
  /** Nome do parceiro (snapshot no momento do aceite) */
  partner_name?: string;
  /** Valor da comissão em R$ (calculado no momento do aceite e congelado) */
  partner_commission_value?: number;
  /** Controle se a comissão já foi paga ao parceiro */
  partner_commission_paid?: boolean;
  created_at: Timestamp;
}

export type NewOrder = Omit<Order, "id">;

// =====================================================
// CART TYPES (Vitrine Pública)
// =====================================================

export interface CartItem {
  /** ID do CatalogItem */
  catalogItemId: string;
  name: string;
  /** headline_venda ou name */
  displayName: string;
  imageUrl?: string;
  /** Preço unitário efetivo (preco_venda_loja ?? calculated_price) */
  unitPrice: number;
  quantity: number;
}

/** Payload enviado ao Firestore pelo cliente anônimo */
export interface StoreOrder {
  cliente_nome: string;
  cliente_telefone: string;
  cart_items: CartItem[];
  valor_total: number;
  coupon_code?: string;
  discount_amount?: number;
  origem: "site";
  production_status: "pending_approval";
  payment_status: "Pendente";
  // Campos obrigatórios herdados do schema Order (preenchidos com defaults)
  instagram_handle: string;
  catalog_item_id: string;
  piece_name: string;
  material: string;
  price: number;
  shortCode?: string;
}

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
