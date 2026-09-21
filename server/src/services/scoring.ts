export const DIMENSIONS = [
  'LIDERAZGO', 'COMUNICACION', 'RECONOCIMIENTO', 'CARGA_TRABAJO', 'DESARROLLO', 'CONDICIONES', 'PERMANENCIA',
] as const;
export type Dim = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dim, string> = {
  LIDERAZGO: 'Liderazgo',
  COMUNICACION: 'Comunicación',
  RECONOCIMIENTO: 'Reconocimiento',
  CARGA_TRABAJO: 'Carga de trabajo',
  DESARROLLO: 'Desarrollo',
  CONDICIONES: 'Condiciones',
  PERMANENCIA: 'Permanencia',
};

export interface AnswerRow { dimension: Dim; value: number }

/** Porcentaje de respuestas con valor 4 o 5. Vacío devuelve null. */
export function favorablePct(values: number[]): number | null {
  if (values.length === 0) return null;
  return (values.filter((v) => v >= 4).length / values.length) * 100;
}

/** Distribución 1-2 desfavorable, 3 neutral, 4-5 favorable. Vacío devuelve todo null. */
export function distributionPct(values: number[]): { favorable: number | null; neutral: number | null; desfavorable: number | null } {
  if (values.length === 0) return { favorable: null, neutral: null, desfavorable: null };
  const n = values.length;
  const favorable = (values.filter((v) => v >= 4).length / n) * 100;
  const desfavorable = (values.filter((v) => v <= 2).length / n) * 100;
  return { favorable, neutral: 100 - favorable - desfavorable, desfavorable };
}

export interface DimSummary { n: number; favorable: number | null; neutral: number | null; desfavorable: number | null }
export interface AreaSummary { byDimension: Record<Dim, DimSummary>; global: number | null }

export function summarize(rows: AnswerRow[]): AreaSummary {
  const byDimension = {} as Record<Dim, DimSummary>;
  for (const d of DIMENSIONS) {
    const vals = rows.filter((r) => r.dimension === d).map((r) => r.value);
    byDimension[d] = { n: vals.length, ...distributionPct(vals) };
  }
  return { byDimension, global: favorablePct(rows.map((r) => r.value)) };
}

export const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

export const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);
