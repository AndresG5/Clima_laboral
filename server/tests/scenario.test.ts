import { describe, it, expect } from 'vitest';
import { AREAS, HEADCOUNT, PARTICIPATION, mulberry32, simulateRespondent, turnoverFor, type AreaName } from '../prisma/scenario.js';
import { DIMENSIONS, summarize, type AnswerRow } from '../src/services/scoring.js';
import { computeRisk, annualizedTurnover, DEFAULT_WEIGHTS, DEFAULT_LEVELS } from '../src/services/riskModel.js';

function run(seed: number) {
  const rng = mulberry32(seed);
  const turnover = Object.fromEntries(AREAS.map((a) => [a, turnoverFor(a, rng).slice(-6)])) as Record<AreaName, ReturnType<typeof turnoverFor>>;
  const summaries = (idx: number) =>
    Object.fromEntries(AREAS.map((a) => {
      const n = Math.round(HEADCOUNT[a] * PARTICIPATION[a]);
      const rows: AnswerRow[] = [];
      for (let i = 0; i < n; i++) {
        const r = simulateRespondent(a, idx, 3, rng);
        for (const d of DIMENSIONS) for (const v of r[d]) rows.push({ dimension: d, value: v });
      }
      return [a, { n, s: summarize(rows) }];
    })) as Record<AreaName, { n: number; s: ReturnType<typeof summarize> }>;
  const prev = summaries(1);
  const curr = summaries(2);
  return (a: AreaName) =>
    computeRisk({
      summary: curr[a].s, responses: curr[a].n, minGroupSize: 5,
      previousGlobal: prev[a].s.global, annualizedTurnover: annualizedTurnover(turnover[a]),
    }, DEFAULT_WEIGHTS, DEFAULT_LEVELS);
}

describe('escenario simulado del seed', () => {
  it('con la semilla 42: Producción CRITICO, Almacén ALTO, Mantenimiento BAJO', () => {
    const risk = run(42);
    expect(risk('Producción').level).toBe('CRITICO');
    expect(risk('Almacén').level).toBe('ALTO');
    expect(risk('Mantenimiento').level).toBe('BAJO');
    for (const a of ['Calidad', 'Administrativo'] as const) expect(['BAJO', 'MEDIO']).toContain(risk(a).level);
  });
  it('es robusto: 40 semillas distintas dan el mismo resultado', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const risk = run(seed);
      expect(risk('Producción').level, `semilla ${seed}`).toBe('CRITICO');
      expect(risk('Almacén').level, `semilla ${seed}`).toBe('ALTO');
      expect(['BAJO', 'MEDIO']).toContain(risk('Calidad').level);
      expect(['BAJO', 'MEDIO']).toContain(risk('Administrativo').level);
      expect(risk('Mantenimiento').level).toBe('BAJO');
    }
  });
});
