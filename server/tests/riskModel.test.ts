import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LEVELS, DEFAULT_WEIGHTS, annualizedTurnover, computeRisk, levelFor, rotacionHistorica, tendencia, validateLevels, validateWeights,
  type RiskInput,
} from '../src/services/riskModel.js';
import { DIMENSIONS, type AreaSummary, type Dim } from '../src/services/scoring.js';

const summary = (fav: Partial<Record<Dim, number>>, base = 75, global = base): AreaSummary => ({
  byDimension: Object.fromEntries(DIMENSIONS.map((d) => [d, { n: 30, favorable: fav[d] ?? base }])) as AreaSummary['byDimension'],
  global,
});
const input = (o: Partial<RiskInput> & { summary: AreaSummary }): RiskInput => ({
  responses: 30, minGroupSize: 5, previousGlobal: null, annualizedTurnover: null, ...o,
});

describe('modelo de riesgo de rotación', () => {
  it('área sana: índice bajo y sin alerta', () => {
    const r = computeRisk(input({ summary: summary({}, 85, 85), previousGlobal: 84, annualizedTurnover: 10 }), DEFAULT_WEIGHTS, DEFAULT_LEVELS);
    // 0.30*15 + 0.20*15 + 0.15*15 + 0.10*15 + 0.10*15 + 0.10*0 + 0.05*(10/60*100)
    expect(r.score).toBeCloseTo(4.5 + 3 + 2.25 + 1.5 + 1.5 + 0 + 0.05 * (10 / 60) * 100, 6);
    expect(r.level).toBe('BAJO');
  });

  it('área en riesgo: valores conocidos dan CRITICO', () => {
    const r = computeRisk(input({
      summary: summary({ PERMANENCIA: 10, LIDERAZGO: 20, COMUNICACION: 30, RECONOCIMIENTO: 30, CARGA_TRABAJO: 25 }, 50, 30),
      previousGlobal: 50, annualizedTurnover: 60,
    }), DEFAULT_WEIGHTS, DEFAULT_LEVELS);
    // 0.30*90 + 0.20*80 + 0.15*70 + 0.10*70 + 0.10*75 + 0.10*100 + 0.05*100
    expect(r.score).toBeCloseTo(27 + 16 + 10.5 + 7 + 7.5 + 10 + 5, 6);
    expect(r.level).toBe('CRITICO');
  });

  it('área sin encuesta previa: la tendencia vale 0', () => {
    expect(tendencia(null, 40)).toBe(0);
    const r = computeRisk(input({ summary: summary({}, 50), previousGlobal: null }), DEFAULT_WEIGHTS, DEFAULT_LEVELS);
    expect(r.components.find((c) => c.key === 'TENDENCIA')?.raw).toBe(0);
  });

  it('muestra insuficiente: no calcula índice ni alerta', () => {
    const r = computeRisk(input({ summary: summary({}, 10), responses: 4, minGroupSize: 5 }), DEFAULT_WEIGHTS, DEFAULT_LEVELS);
    expect(r).toMatchObject({ insufficient: true, score: null, level: null, drivers: [] });
  });

  it('guarda los 3 componentes que más aportan, de mayor a menor', () => {
    const r = computeRisk(input({ summary: summary({ PERMANENCIA: 0, LIDERAZGO: 10 }, 90), annualizedTurnover: 0 }), DEFAULT_WEIGHTS, DEFAULT_LEVELS);
    expect(r.drivers.map((d) => d.key)).toEqual(['PERMANENCIA', 'LIDERAZGO', 'COMUNICACION']);
    expect(r.drivers[0].contribution).toBeGreaterThanOrEqual(r.drivers[1].contribution);
  });

  it('la tendencia solo cuenta caídas y se limita a 0-100', () => {
    expect(tendencia(50, 60)).toBe(0);
    expect(tendencia(80, 70)).toBe(50);
    expect(tendencia(90, 40)).toBe(100);
  });

  it('rotación anualizada y su normalización', () => {
    expect(annualizedTurnover([])).toBeNull();
    // 6 meses, plantilla 100, 3 salidas por mes: 18 / 100 * 2 = 36 %
    expect(annualizedTurnover(Array.from({ length: 6 }, () => ({ headcountStart: 100, exits: 3 })))).toBeCloseTo(36, 6);
    expect(rotacionHistorica(30)).toBe(50);
    expect(rotacionHistorica(120)).toBe(100);
  });

  it('niveles: 59.9 medio, 60 alto, 75 crítico', () => {
    expect(levelFor(39.9, DEFAULT_LEVELS)).toBe('BAJO');
    expect(levelFor(40, DEFAULT_LEVELS)).toBe('MEDIO');
    expect(levelFor(59.9, DEFAULT_LEVELS)).toBe('MEDIO');
    expect(levelFor(60, DEFAULT_LEVELS)).toBe('ALTO');
    expect(levelFor(75, DEFAULT_LEVELS)).toBe('CRITICO');
  });

  it('cambiar los pesos cambia el resultado', () => {
    const inp = input({ summary: summary({ PERMANENCIA: 0 }, 90), annualizedTurnover: 0 });
    const base = computeRisk(inp, DEFAULT_WEIGHTS, DEFAULT_LEVELS).score as number;
    const heavier = computeRisk(inp, { ...DEFAULT_WEIGHTS, PERMANENCIA: 50, LIDERAZGO: 0 }, DEFAULT_LEVELS).score as number;
    expect(heavier).toBeGreaterThan(base);
  });

  it('valida que los pesos sumen 100 y que los umbrales estén ordenados', () => {
    expect(validateWeights(DEFAULT_WEIGHTS)).toBeNull();
    expect(validateWeights({ ...DEFAULT_WEIGHTS, PERMANENCIA: 40 })).toMatch(/suman 110/);
    expect(validateLevels(DEFAULT_LEVELS)).toBeNull();
    expect(validateLevels({ medio: 70, alto: 60, critico: 75 })).not.toBeNull();
  });
});
