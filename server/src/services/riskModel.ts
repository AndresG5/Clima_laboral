import { DIMENSION_LABELS, type Dim, type AreaSummary } from './scoring.js';

/**
 * Índice ponderado y explicable de riesgo de rotación (0 a 100).
 * No es machine learning: los pesos son supuestos de trabajo, no están
 * calibrados con datos reales de la empresa.
 */
export type ComponentKey =
  | 'PERMANENCIA' | 'LIDERAZGO' | 'COMUNICACION' | 'RECONOCIMIENTO' | 'CARGA_TRABAJO'
  | 'TENDENCIA' | 'ROTACION';

/** Pesos en puntos porcentuales; deben sumar 100. */
export type RiskWeights = Record<ComponentKey, number>;
export interface RiskLevels { medio: number; alto: number; critico: number }

export const DEFAULT_WEIGHTS: RiskWeights = {
  PERMANENCIA: 30, LIDERAZGO: 20, COMUNICACION: 15, RECONOCIMIENTO: 10, CARGA_TRABAJO: 10, TENDENCIA: 10, ROTACION: 5,
};
export const DEFAULT_LEVELS: RiskLevels = { medio: 40, alto: 60, critico: 75 };

export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  PERMANENCIA: 'Intención de permanencia',
  LIDERAZGO: DIMENSION_LABELS.LIDERAZGO,
  COMUNICACION: DIMENSION_LABELS.COMUNICACION,
  RECONOCIMIENTO: DIMENSION_LABELS.RECONOCIMIENTO,
  CARGA_TRABAJO: DIMENSION_LABELS.CARGA_TRABAJO,
  TENDENCIA: 'Caída frente a la encuesta anterior',
  ROTACION: 'Rotación histórica',
};

export type RiskLevel = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export interface RiskInput {
  /** % favorable por dimensión en la encuesta actual. */
  summary: AreaSummary;
  /** Respuestas (personas) del área en la encuesta. */
  responses: number;
  /** Umbral k de anonimato. */
  minGroupSize: number;
  /** % favorable global de la encuesta anterior; null si no existe. */
  previousGlobal: number | null;
  /** Rotación anualizada en % (últimos 6 meses); null si no hay datos. */
  annualizedTurnover: number | null;
}

export interface RiskComponent {
  key: ComponentKey;
  label: string;
  weight: number;
  /** Valor 0 a 100 antes de ponderar. */
  raw: number;
  /** Puntos que aporta al índice. */
  contribution: number;
}

export interface RiskResult {
  insufficient: boolean;
  score: number | null;
  level: RiskLevel | null;
  components: RiskComponent[];
  /** Los 3 componentes que más aportan. */
  drivers: RiskComponent[];
}

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export const tendencia = (previous: number | null, current: number | null): number =>
  previous === null || current === null ? 0 : clamp((previous - current) * 5, 0, 100);

export const rotacionHistorica = (annualized: number | null): number =>
  annualized === null ? 0 : clamp((annualized / 60) * 100, 0, 100);

/** Rotación anualizada a partir de meses recientes: salidas / plantilla promedio, por 12/meses. */
export function annualizedTurnover(records: { headcountStart: number; exits: number }[]): number | null {
  if (records.length === 0) return null;
  const exits = records.reduce((a, r) => a + r.exits, 0);
  const avgHead = records.reduce((a, r) => a + r.headcountStart, 0) / records.length;
  if (avgHead <= 0) return null;
  return (exits / avgHead) * (12 / records.length) * 100;
}

export function levelFor(score: number, levels: RiskLevels): RiskLevel {
  if (score >= levels.critico) return 'CRITICO';
  if (score >= levels.alto) return 'ALTO';
  if (score >= levels.medio) return 'MEDIO';
  return 'BAJO';
}

export function validateWeights(w: RiskWeights): string | null {
  const keys = Object.keys(DEFAULT_WEIGHTS) as ComponentKey[];
  for (const k of keys) if (typeof w[k] !== 'number' || w[k] < 0) return `El peso de ${COMPONENT_LABELS[k]} debe ser un número mayor o igual a 0.`;
  const sum = keys.reduce((a, k) => a + w[k], 0);
  if (Math.abs(sum - 100) > 0.001) return `Los pesos suman ${sum} %. Ajusta los valores para que sumen 100 %.`;
  return null;
}

export function validateLevels(l: RiskLevels): string | null {
  if (!(l.medio > 0 && l.medio < l.alto && l.alto < l.critico && l.critico <= 100)) {
    return 'Los umbrales deben cumplir: 0 < medio < alto < crítico ≤ 100.';
  }
  return null;
}

export function computeRisk(input: RiskInput, weights: RiskWeights, levels: RiskLevels): RiskResult {
  if (input.responses < input.minGroupSize) {
    return { insufficient: true, score: null, level: null, components: [], drivers: [] };
  }
  const desf = (d: Dim): number => {
    const f = input.summary.byDimension[d].favorable;
    return f === null ? 0 : 100 - f;
  };
  const raws: Record<ComponentKey, number> = {
    PERMANENCIA: desf('PERMANENCIA'),
    LIDERAZGO: desf('LIDERAZGO'),
    COMUNICACION: desf('COMUNICACION'),
    RECONOCIMIENTO: desf('RECONOCIMIENTO'),
    CARGA_TRABAJO: desf('CARGA_TRABAJO'),
    TENDENCIA: tendencia(input.previousGlobal, input.summary.global),
    ROTACION: rotacionHistorica(input.annualizedTurnover),
  };
  const components: RiskComponent[] = (Object.keys(raws) as ComponentKey[]).map((key) => ({
    key,
    label: COMPONENT_LABELS[key],
    weight: weights[key],
    raw: raws[key],
    contribution: (weights[key] / 100) * raws[key],
  }));
  const score = components.reduce((a, c) => a + c.contribution, 0);
  const drivers = [...components].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  return { insufficient: false, score, level: levelFor(score, levels), components, drivers };
}
