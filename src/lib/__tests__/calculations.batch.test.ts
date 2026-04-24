/**
 * Testes Unitários: calculateBatchTimeAndCost
 * Arquivo: src/lib/__tests__/calculations.batch.test.ts
 *
 * Valida a lógica de desconto de tempo em lote (Batch Printing Discount Engine).
 * Nenhuma dependência de Firebase é necessária aqui — funções puras 100%.
 */

import {
  calculateBatchTimeAndCost,
  PRINTER_SETUP_TIME_MINUTES,
  MAX_TRAVEL_PENALTY_MINUTES,
  TRAVEL_PENALTY_PERCENTAGE,
  MACHINE_HOUR_COST_BRL,
  FAILURE_RATE,
} from '@/lib/calculations';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tempo de extrusão real por peça (após remover o setup incluso no unitTime) */
const realExtrusion = (unitTime: number) =>
  Math.max(unitTime - PRINTER_SETUP_TIME_MINUTES, 1);

/** Tempo físico bruto do lote sem travel penalty */
const rawBatchBase = (unitTime: number, qty: number) =>
  PRINTER_SETUP_TIME_MINUTES + realExtrusion(unitTime) * qty;

/** Travel penalty com cap */
const travelPenalty = (base: number) =>
  Math.min(base * (TRAVEL_PENALTY_PERCENTAGE - 1), MAX_TRAVEL_PENALTY_MINUTES);

// ─── Constantes de configuração ───────────────────────────────────────────────

describe('Constantes de configuração do lote', () => {
  it('PRINTER_SETUP_TIME_MINUTES deve ser 6', () => {
    expect(PRINTER_SETUP_TIME_MINUTES).toBe(6);
  });

  it('MAX_TRAVEL_PENALTY_MINUTES deve ser 12', () => {
    expect(MAX_TRAVEL_PENALTY_MINUTES).toBe(12);
  });

  it('TRAVEL_PENALTY_PERCENTAGE deve ser 1.02 (2% de overhead)', () => {
    expect(TRAVEL_PENALTY_PERCENTAGE).toBe(1.02);
  });
});

// ─── Quantidade = 1 (sem benefício de lote) ────────────────────────────────────

describe('calculateBatchTimeAndCost — qty = 1', () => {
  const unitTime = 60; // 1 hora

  it('batchTimeInMinutes deve ser igual ao unitTimeMinutes', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: 1 });
    expect(result.batchTimeInMinutes).toBe(unitTime);
  });

  it('timeSavedInMinutes deve ser 0', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: 1 });
    expect(result.timeSavedInMinutes).toBe(0);
  });

  it('isolatedTotalTimeInMinutes deve ser igual ao unitTimeMinutes', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: 1 });
    expect(result.isolatedTotalTimeInMinutes).toBe(unitTime);
  });

  it('continuousProductionMode deve ser false', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: 1 });
    expect(result.continuousProductionMode).toBe(false);
  });
});

// ─── Desconto de Setup sendo aplicado corretamente ────────────────────────────

describe('calculateBatchTimeAndCost — Desconto de Tempo em Lote (peça pequena)', () => {
  /**
   * Peça pequena: 20 min por unidade.
   * Real extrusion = max(20 - 6, 1) = 14 min
   * raw base (qty=4) = 6 + 14*4 = 62 min
   * travel penalty = min(62*0.02, 12) = min(1.24, 12) = 1.24 min
   * physicalBatchTime = 62 + 1.24 = 63.24 min
   * isolatedTotal = 20 * 4 = 80 min
   * physicalBatch < isolated → economiza tempo
   * timeSaved = 80 - 63.24 = 16.76 → ceil = 17
   */
  const unitTime = 20;
  const qty = 4;

  it('batchTimeInMinutes deve ser menor que isolatedTotalTimeInMinutes', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.batchTimeInMinutes).toBeLessThan(result.isolatedTotalTimeInMinutes);
  });

  it('isolatedTotalTimeInMinutes deve ser unitTime * qty = 80', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.isolatedTotalTimeInMinutes).toBe(unitTime * qty);
  });

  it('timeSavedInMinutes deve ser positivo', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.timeSavedInMinutes).toBeGreaterThan(0);
  });

  it('continuousProductionMode deve ser false (lote economiza tempo)', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.continuousProductionMode).toBe(false);
  });

  it('batchTimeInMinutes calculado bate com a fórmula manual', () => {
    const base = rawBatchBase(unitTime, qty);
    const penalty = travelPenalty(base);
    const expected = Math.ceil(base + penalty);
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.batchTimeInMinutes).toBe(expected);
  });
});

// ─── Setup de 6 min é descontado uma única vez, independente da qty ──────────

describe('calculateBatchTimeAndCost — Setup cobrado apenas 1x no lote', () => {
  /**
   * Verifica que o custo de setup (6 min) só ocorre UMA vez no lote,
   * não qty vezes. Para isso, comparamos qty=1 vs qty=2 do mesmo item.
   *
   * Peça de 30 min, qty=2:
   * realExtrusion = 30 - 6 = 24
   * rawBase = 6 + 24*2 = 54
   * Se setup fosse cobrado 2x seria 6*2 + 24*2 = 60 (errado)
   */
  it('batchTimeInMinutes com qty=2 NÃO deve ser o dobro do batchTime com qty=1', () => {
    const res1 = calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 1 });
    const res2 = calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 2 });
    expect(res2.batchTimeInMinutes).toBeLessThan(res1.batchTimeInMinutes * 2);
  });

  it('a diferença de tempo entre qty=1 e qty=2 reflete apenas a extrusão adicional', () => {
    const res1 = calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 1 });
    const res2 = calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 2 });
    // A diferença deve ser próxima ao real extrusion (24 min), não ao unitTime completo (30 min)
    const diff = res2.batchTimeInMinutes - res1.batchTimeInMinutes;
    // Deve ser menor que unitTimeMinutes (30) pois setup não se repete
    expect(diff).toBeLessThan(30);
  });
});

// ─── Peça grande: continuousProductionMode ────────────────────────────────────

describe('calculateBatchTimeAndCost — Peça grande (continuousProductionMode)', () => {
  /**
   * Peça de 600 min (10 horas), qty=2:
   * realExtrusion = 600 - 6 = 594
   * rawBase = 6 + 594*2 = 1194
   * penalty = min(1194*0.02, 12) = 12 (atingiu o cap)
   * physicalBatch = 1206 > isolated (1200) → continuousProductionMode = true
   */
  const unitTime = 600;
  const qty = 2;

  it('deve ativar continuousProductionMode = true para peças grandes', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.continuousProductionMode).toBe(true);
  });

  it('batchTimeInMinutes deve ser igual a isolatedTotalTimeInMinutes em modo contínuo', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.batchTimeInMinutes).toBe(result.isolatedTotalTimeInMinutes);
  });

  it('timeSavedInMinutes deve ser 0 em modo contínuo', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: unitTime, quantity: qty });
    expect(result.timeSavedInMinutes).toBe(0);
  });
});

// ─── Travel Penalty Cap (máximo 12 min) ───────────────────────────────────────

describe('calculateBatchTimeAndCost — Travel Penalty Cap', () => {
  /**
   * Garante que a penalidade de viagem é limitada a 12 min.
   * rawBase enorme (qty grande) → 2% de base muito grande > 12 → cap deve ser 12.
   */
  it('a travel penalty não deve ultrapassar MAX_TRAVEL_PENALTY_MINUTES = 12', () => {
    // qty = 50, unitTime = 20 → rawBase = 6 + 14*50 = 706 → 2% = 14.12 > 12 → cap = 12
    const res = calculateBatchTimeAndCost({ unitTimeMinutes: 20, quantity: 50 });
    // isolated = 20*50 = 1000 min
    // rawBase = 6 + 14*50 = 706
    // com cap = 706 + 12 = 718, sem cap seria 706 + 14.12 = 720.12
    // 718 < 1000 → não é continuous mode → batchTime deverá ser ceil(718)
    expect(res.batchTimeInMinutes).toBeLessThanOrEqual(
      Math.ceil(rawBatchBase(20, 50) + MAX_TRAVEL_PENALTY_MINUTES)
    );
  });
});

// ─── Custo de Filamento no Lote ───────────────────────────────────────────────

describe('calculateBatchTimeAndCost — Custo de Filamento', () => {
  it('custo de filamento total deve escalar proporcionalmente com qty', () => {
    const res1 = calculateBatchTimeAndCost({
      unitTimeMinutes: 30,
      quantity: 1,
      unitWeightGrams: 50,
      material: 'PLA',
    });
    const res2 = calculateBatchTimeAndCost({
      unitTimeMinutes: 30,
      quantity: 3,
      unitWeightGrams: 50,
      material: 'PLA',
    });
    // Filamento é linear: 3x a quantidade → 3x o custo de filamento
    expect(res2.batchTotalFilamentCost).toBeCloseTo(res1.batchTotalFilamentCost * 3, 2);
  });

  it('deve aceitar múltiplos filamentos (unitFilaments[])', () => {
    const result = calculateBatchTimeAndCost({
      unitTimeMinutes: 30,
      quantity: 2,
      unitFilaments: [
        { material: 'PLA', weight_grams: 30 },
        { material: 'PETG', weight_grams: 20 },
      ],
    });
    // PLA: (30*2/1000)*110 = 6.6 | PETG: (20*2/1000)*150 = 6.0 | total = 12.6
    expect(result.batchTotalFilamentCost).toBeCloseTo(12.6, 2);
  });

  it('deve retornar custo de filamento 0 quando nenhum filamento é passado', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 2 });
    expect(result.batchTotalFilamentCost).toBe(0);
  });
});

// ─── Margem de Lucro Aplicada ao Lote ────────────────────────────────────────

describe('calculateBatchTimeAndCost — Margem de Lucro', () => {
  it('profitMargin deve ser 0.6 (60%) por padrão', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 1 });
    expect(result.profitMargin).toBeCloseTo(0.6, 5);
  });

  it('deve respeitar a margem customizada em porcentagem', () => {
    const result = calculateBatchTimeAndCost({
      unitTimeMinutes: 30,
      quantity: 1,
      profitMarginPercent: 40,
    });
    expect(result.profitMargin).toBeCloseTo(0.4, 5);
  });

  it('batchSuggestedPrice = totalBaseCost / (1 - margin)', () => {
    const result = calculateBatchTimeAndCost({
      unitTimeMinutes: 60,
      quantity: 1,
      unitWeightGrams: 100,
      material: 'PLA',
      profitMarginPercent: 50,
    });
    // Nota: round2() é aplicado nos campos intermediários antes do cálculo do preço,
    // então usamos precisão de 1 casa decimal para absorver a diferença de arredondamento.
    const expectedPrice = result.batchTotalBaseCost / (1 - 0.5);
    expect(result.batchSuggestedPrice).toBeCloseTo(expectedPrice, 1);
  });
});

// ─── Proteção contra qty <= 0 ────────────────────────────────────────────────

describe('calculateBatchTimeAndCost — Proteção de Edge Cases', () => {
  it('qty = 0 não deve gerar erro (tratado como qty = 1)', () => {
    expect(() =>
      calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: 0 })
    ).not.toThrow();
  });

  it('qty negativo não deve gerar erro (tratado como qty = 1)', () => {
    expect(() =>
      calculateBatchTimeAndCost({ unitTimeMinutes: 30, quantity: -5 })
    ).not.toThrow();
  });

  it('unitTimeMinutes muito pequeno (1 min) — realExtrusion = max(1-6,1) = 1', () => {
    const result = calculateBatchTimeAndCost({ unitTimeMinutes: 1, quantity: 3 });
    // realExtrusion = max(1 - 6, 1) = 1 (protegido)
    // rawBase = 6 + 1*3 = 9
    // penalty = min(9*0.02, 12) = 0.18
    // physicalBatch = 9.18 < isolated (3) → FALSO! 9.18 > 3 → continuousMode = true
    expect(result.continuousProductionMode).toBe(true);
  });
});
