// =====================================================
// VARIÁVEIS DE CUSTO - AJUSTE CONFORME SUA REALIDADE
// =====================================================

/**
 * Custo da hora-máquina da impressora (energia + depreciação)
 * Valor em Reais (R$)
 */
export const MACHINE_HOUR_COST_BRL = 2.5;

/**
 * Custo do kg de filamento por material (em R$)
 */
export const FILAMENT_COST_PER_KG: Record<string, number> = {
  PLA: 110,
  "PLA+": 130,
  PETG: 150,
  ABS: 120,
  ASA: 170,
  TPU: 220,
};

/**
 * Taxa de falha esperada (5% = 0.05)
 * Cobre perdas por falhas de impressão
 */
export const FAILURE_RATE = 0.05;

/**
 * Margem de lucro padrão (60% = 0.6)
 */
export const DEFAULT_PROFIT_MARGIN = 0.6;

// =====================================================
// TIPOS
// =====================================================

export interface CostCalculationInput {
  timeHours: number;
  timeMinutes: number;
  profitMarginPercent?: number;
  
  // Legacy
  weightGrams?: number;
  material?: string;
  
  // New
  filaments?: { material: string; weight_grams: number }[];
}

export interface CostCalculationResult {
  filamentCost: number;
  machineCost: number;
  failureBuffer: number;
  totalBaseCost: number;
  suggestedPrice: number;
  profitMargin: number;
  timeInMinutes: number;
}

// =====================================================
// FUNÇÕES DE CÁLCULO
// =====================================================

/**
 * Calcula o custo de filamento baseado no peso e material
 */
export function calculateFilamentCost(
  weightGrams: number,
  material: string
): number {
  const costPerKg =
    FILAMENT_COST_PER_KG[material] ?? FILAMENT_COST_PER_KG["PLA"];
  return (weightGrams / 1000) * costPerKg;
}

/**
 * Calcula o custo de máquina baseado no tempo
 */
export function calculateMachineCost(
  hours: number,
  minutes: number
): number {
  const totalHours = hours + minutes / 60;
  return totalHours * MACHINE_HOUR_COST_BRL;
}

/**
 * Função principal de cálculo de custo e preço sugerido
 */
export function calculatePrintCost(
  input: CostCalculationInput
): CostCalculationResult {
  const { weightGrams, timeHours, timeMinutes, material, filaments, profitMarginPercent } = input;

  const margin =
    profitMarginPercent != null
      ? profitMarginPercent / 100
      : DEFAULT_PROFIT_MARGIN;

  let filamentCost = 0;
  if (filaments && filaments.length > 0) {
    for (const f of filaments) {
      filamentCost += calculateFilamentCost(f.weight_grams, f.material);
    }
  } else if (weightGrams && material) {
    filamentCost = calculateFilamentCost(weightGrams, material);
  }

  const machineCost = calculateMachineCost(timeHours, timeMinutes);
  const failureBuffer = (filamentCost + machineCost) * FAILURE_RATE;
  const totalBaseCost = filamentCost + machineCost + failureBuffer;
  const suggestedPrice = totalBaseCost / (1 - margin);
  const timeInMinutes = timeHours * 60 + timeMinutes;

  return {
    filamentCost: round2(filamentCost),
    machineCost: round2(machineCost),
    failureBuffer: round2(failureBuffer),
    totalBaseCost: round2(totalBaseCost),
    suggestedPrice: round2(suggestedPrice),
    profitMargin: margin,
    timeInMinutes,
  };
}

/**
 * Formata valor em Real Brasileiro
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata tempo em minutos para "Xh Ym"
 */
export function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Constantes de Impressão (Física)
 */
export const PRINTER_SETUP_TIME_MINUTES = 6;
export const TRAVEL_PENALTY_PERCENTAGE = 1.02;

export interface BatchCostCalculationInput {
  unitTimeMinutes: number;
  quantity: number;
  profitMarginPercent?: number;
  
  // Legacy
  unitWeightGrams?: number;
  material?: string;
  
  // New
  unitFilaments?: { material: string; weight_grams: number }[];
}

export interface BatchCostCalculationResult {
  batchTotalFilamentCost: number;
  batchTotalMachineCost: number;
  batchTotalFailureBuffer: number;
  batchTotalBaseCost: number;
  batchSuggestedPrice: number;
  batchTimeInMinutes: number;
  isolatedTotalTimeInMinutes: number;
  timeSavedInMinutes: number;
  profitMargin: number;
}

/**
 * Calcula o tempo estimado e os custos totais baseados em economia de escala em lote (redução do tempo fixo de setup).
 */
export function calculateBatchTimeAndCost(
  input: BatchCostCalculationInput
): BatchCostCalculationResult {
  const { unitWeightGrams, unitTimeMinutes, quantity, material, unitFilaments, profitMarginPercent } = input;
  const margin = profitMarginPercent != null ? profitMarginPercent / 100 : DEFAULT_PROFIT_MARGIN;

  const qty = Math.max(1, quantity);

  // Lógica de Otimização de Lote
  let batchTimeInMinutes = unitTimeMinutes;
  if (qty > 1) {
    const realExtrusionPerPiece = Math.max(unitTimeMinutes - PRINTER_SETUP_TIME_MINUTES, 1);
    batchTimeInMinutes = (PRINTER_SETUP_TIME_MINUTES + (realExtrusionPerPiece * qty)) * TRAVEL_PENALTY_PERCENTAGE;
  }
  
  const isolatedTotalTimeInMinutes = unitTimeMinutes * qty;
  const timeSavedInMinutes = isolatedTotalTimeInMinutes - batchTimeInMinutes;

  // Aplica as fórmulas base de custo com o novo tempo otimizado e peso do lote
  let filamentCost = 0;
  if (unitFilaments && unitFilaments.length > 0) {
    for (const f of unitFilaments) {
      filamentCost += calculateFilamentCost(f.weight_grams * qty, f.material);
    }
  } else if (unitWeightGrams && material) {
    filamentCost = calculateFilamentCost(unitWeightGrams * qty, material);
  }
  
  const machineCost = calculateMachineCost(0, batchTimeInMinutes); // enviando 0 horas e os minutos totais reais
  const failureBuffer = (filamentCost + machineCost) * FAILURE_RATE;
  
  const totalBaseCost = filamentCost + machineCost + failureBuffer;
  const suggestedPrice = totalBaseCost / (1 - margin);

  return {
    batchTotalFilamentCost: round2(filamentCost),
    batchTotalMachineCost: round2(machineCost),
    batchTotalFailureBuffer: round2(failureBuffer),
    batchTotalBaseCost: round2(totalBaseCost),
    batchSuggestedPrice: round2(suggestedPrice),
    batchTimeInMinutes: Math.ceil(batchTimeInMinutes),
    isolatedTotalTimeInMinutes: Math.ceil(isolatedTotalTimeInMinutes),
    timeSavedInMinutes: Math.ceil(timeSavedInMinutes),
    profitMargin: margin,
  };
}

export const MATERIAL_OPTIONS = Object.keys(FILAMENT_COST_PER_KG);

