/**
 * Testes Unitários: Margem Bruta
 * Arquivo: src/lib/__tests__/calculations.margin.test.ts
 *
 * Valida a exatidão financeira do cálculo de margem bruta,
 * derivada da função calculatePrintCost e da fórmula de preço sugerido.
 *
 * Definição de Margem Bruta usada neste projeto:
 *   grossMargin = (sellingPrice - totalBaseCost) / sellingPrice * 100
 *
 * O preço sugerido é calculado por:
 *   suggestedPrice = totalBaseCost / (1 - margin)
 * Logo, a margem bruta implícita no preço sugerido deve ser exatamente `margin`.
 */

import {
  calculatePrintCost,
  calculateFilamentCost,
  calculateMachineCost,
  MACHINE_HOUR_COST_BRL,
  FILAMENT_COST_PER_KG,
  FAILURE_RATE,
  DEFAULT_PROFIT_MARGIN,
} from '@/lib/calculations';

// ─── Helper: calcula margem bruta a partir do preço e custo base ─────────────

function grossMarginPercent(sellingPrice: number, baseCost: number): number {
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - baseCost) / sellingPrice) * 100;
}

// ─── calculateFilamentCost ────────────────────────────────────────────────────

describe('calculateFilamentCost', () => {
  it('PLA: 1000g deve custar R$110.00 (preço por kg)', () => {
    expect(calculateFilamentCost(1000, 'PLA')).toBeCloseTo(110, 2);
  });

  it('PLA: 500g deve custar R$55.00', () => {
    expect(calculateFilamentCost(500, 'PLA')).toBeCloseTo(55, 2);
  });

  it('PETG: 200g deve custar R$30.00', () => {
    // PETG = R$150/kg → 200/1000 * 150 = 30
    expect(calculateFilamentCost(200, 'PETG')).toBeCloseTo(30, 2);
  });

  it('Material desconhecido deve usar o custo do PLA como fallback', () => {
    const unknownCost = calculateFilamentCost(500, 'MATERIAL_INEXISTENTE');
    const plaCost = calculateFilamentCost(500, 'PLA');
    expect(unknownCost).toBeCloseTo(plaCost, 2);
  });

  it('0g qualquer material deve resultar em R$0.00', () => {
    expect(calculateFilamentCost(0, 'ABS')).toBe(0);
  });
});

// ─── calculateMachineCost ─────────────────────────────────────────────────────

describe('calculateMachineCost', () => {
  it('1 hora exata deve custar exatamente MACHINE_HOUR_COST_BRL', () => {
    expect(calculateMachineCost(1, 0)).toBeCloseTo(MACHINE_HOUR_COST_BRL, 5);
  });

  it('30 minutos deve custar metade da hora', () => {
    expect(calculateMachineCost(0, 30)).toBeCloseTo(MACHINE_HOUR_COST_BRL / 2, 5);
  });

  it('1h30 = 1.5 horas deve custar 1.5 * MACHINE_HOUR_COST_BRL', () => {
    expect(calculateMachineCost(1, 30)).toBeCloseTo(MACHINE_HOUR_COST_BRL * 1.5, 5);
  });

  it('0h 0min deve custar R$0.00', () => {
    expect(calculateMachineCost(0, 0)).toBe(0);
  });
});

// ─── Margem Bruta: preço sugerido reflete exatamente a margem solicitada ──────

describe('Margem Bruta — calculatePrintCost', () => {
  const baseInput = {
    timeHours: 1,
    timeMinutes: 0,
    weightGrams: 100,
    material: 'PLA',
  };

  it('margem padrão (60%) deve resultar em suggestedPrice com ~60% de margem bruta', () => {
    const result = calculatePrintCost(baseInput);
    const margin = grossMarginPercent(result.suggestedPrice, result.totalBaseCost);
    expect(margin).toBeCloseTo(60, 1);
  });

  it('margem customizada de 40% deve resultar em ~40% de margem bruta', () => {
    const result = calculatePrintCost({ ...baseInput, profitMarginPercent: 40 });
    const margin = grossMarginPercent(result.suggestedPrice, result.totalBaseCost);
    expect(margin).toBeCloseTo(40, 1);
  });

  it('margem de 0% (break-even): suggestedPrice deve ser igual ao totalBaseCost', () => {
    const result = calculatePrintCost({ ...baseInput, profitMarginPercent: 0 });
    expect(result.suggestedPrice).toBeCloseTo(result.totalBaseCost, 2);
  });

  it('margem de 80%: preço deve ser 5x o custo base (1/(1-0.8) = 5)', () => {
    const result = calculatePrintCost({ ...baseInput, profitMarginPercent: 80 });
    expect(result.suggestedPrice).toBeCloseTo(result.totalBaseCost * 5, 1);
  });
});

// ─── Tratamento de Divisão por Zero ──────────────────────────────────────────

describe('Margem Bruta — Tratamento de Divisão por Zero', () => {
  it('grossMarginPercent com sellingPrice=0 não deve lançar exceção', () => {
    expect(() => grossMarginPercent(0, 0)).not.toThrow();
  });

  it('grossMarginPercent com sellingPrice=0 deve retornar 0', () => {
    expect(grossMarginPercent(0, 100)).toBe(0);
  });

  it('calculatePrintCost com margem de 100% — NÃO deve ser usada (divisão por zero)', () => {
    // Margem 100% → denominador = 1 - 1.0 = 0 → preço infinito
    // A função não tem guard aqui: documentamos que o resultado is Infinity
    const result = calculatePrintCost({ ...{
      timeHours: 1,
      timeMinutes: 0,
      weightGrams: 100,
      material: 'PLA',
    }, profitMarginPercent: 100 });
    expect(result.suggestedPrice).toBe(Infinity);
  });
});

// ─── Consistência Interna dos Campos ─────────────────────────────────────────

describe('calculatePrintCost — Consistência dos campos retornados', () => {
  it('totalBaseCost deve ser filamentCost + machineCost + failureBuffer', () => {
    const result = calculatePrintCost({
      timeHours: 2,
      timeMinutes: 30,
      weightGrams: 200,
      material: 'PETG',
    });
    const expected = result.filamentCost + result.machineCost + result.failureBuffer;
    expect(result.totalBaseCost).toBeCloseTo(expected, 2);
  });

  it('failureBuffer deve ser (filamentCost + machineCost) * FAILURE_RATE', () => {
    const result = calculatePrintCost({
      timeHours: 1,
      timeMinutes: 0,
      weightGrams: 100,
      material: 'PLA',
    });
    // Nota: round2() é aplicado nos campos intermediários antes de retornar,
    // então usamos precisão de 1 casa decimal para absorver a diferença de arredondamento.
    const expected = (result.filamentCost + result.machineCost) * FAILURE_RATE;
    expect(result.failureBuffer).toBeCloseTo(expected, 1);
  });

  it('profitMargin retornado deve corresponder à margem de entrada (em decimal)', () => {
    const result = calculatePrintCost({
      timeHours: 1,
      timeMinutes: 0,
      weightGrams: 100,
      material: 'PLA',
      profitMarginPercent: 55,
    });
    expect(result.profitMargin).toBeCloseTo(0.55, 5);
  });

  it('timeInMinutes deve ser timeHours * 60 + timeMinutes', () => {
    const result = calculatePrintCost({
      timeHours: 2,
      timeMinutes: 45,
      weightGrams: 100,
      material: 'PLA',
    });
    expect(result.timeInMinutes).toBe(2 * 60 + 45);
  });

  it('suporte a múltiplos filamentos (filaments[]) soma todos os custos', () => {
    const result = calculatePrintCost({
      timeHours: 1,
      timeMinutes: 0,
      filaments: [
        { material: 'PLA', weight_grams: 100 },
        { material: 'PETG', weight_grams: 50 },
      ],
    });
    // PLA: 100/1000 * 110 = 11 | PETG: 50/1000 * 150 = 7.5 | total = 18.5
    expect(result.filamentCost).toBeCloseTo(18.5, 2);
  });
});

// ─── Verificação dos Valores de FILAMENT_COST_PER_KG ────────────────────────

describe('FILAMENT_COST_PER_KG — tabela de preços', () => {
  const expectedPrices: Record<string, number> = {
    PLA: 110,
    'PLA+': 130,
    PETG: 150,
    ABS: 120,
    ASA: 170,
    TPU: 220,
  };

  Object.entries(expectedPrices).forEach(([material, price]) => {
    it(`${material} deve custar R$${price}/kg`, () => {
      expect(FILAMENT_COST_PER_KG[material]).toBe(price);
    });
  });
});
