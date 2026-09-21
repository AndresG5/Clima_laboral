/**
 * Escenario simulado (puro, sin base de datos). Lo usan el seed y una prueba
 * que comprueba que el escenario diseñado produce las alertas esperadas.
 */
import { DIMENSIONS, type Dim } from '../src/services/scoring.js';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const AREAS = ['Producción', 'Calidad', 'Almacén', 'Mantenimiento', 'Administrativo'] as const;
export type AreaName = (typeof AREAS)[number];

export const HEADCOUNT: Record<AreaName, number> = {
  Producción: 80, Calidad: 25, Almacén: 35, Mantenimiento: 25, Administrativo: 35,
};

/** Rotación mensual (fracción de la plantilla que sale por mes). */
export const MONTHLY_TURNOVER: Record<AreaName, number> = {
  Producción: 0.045, Calidad: 0.012, Almacén: 0.035, Mantenimiento: 0.01, Administrativo: 0.015,
};

export const PARTICIPATION: Record<AreaName, number> = {
  Producción: 0.72, Calidad: 0.9, Almacén: 0.8, Mantenimiento: 0.92, Administrativo: 0.88,
};

export const CLIMA_SURVEYS = [
  { key: 'T1', title: 'Clima laboral, primer trimestre 2026', closesAt: '2026-03-20' },
  { key: 'T2', title: 'Clima laboral, segundo trimestre 2026', closesAt: '2026-06-19' },
  { key: 'T3', title: 'Clima laboral, tercer trimestre 2026', closesAt: '2026-09-18' },
] as const;

// Probabilidad de respuesta favorable (4 o 5) por dimensión, en el orden de DIMENSIONS:
// LIDERAZGO, COMUNICACION, RECONOCIMIENTO, CARGA_TRABAJO, DESARROLLO, CONDICIONES, PERMANENCIA
const T: Record<AreaName, number[][]> = {
  // Producción, turno nocturno: liderazgo bajo y permanencia en caída.
  Producción: [
    [0.55, 0.55, 0.5, 0.45, 0.55, 0.6, 0.55],
    [0.42, 0.45, 0.42, 0.38, 0.5, 0.55, 0.4],
    [0.12, 0.2, 0.22, 0.18, 0.4, 0.45, 0.06],
  ],
  // Almacén: clima aceptable pero con tendencia negativa marcada.
  Almacén: [
    [0.72, 0.72, 0.7, 0.68, 0.72, 0.74, 0.74],
    [0.68, 0.68, 0.66, 0.64, 0.68, 0.7, 0.68],
    [0.37, 0.43, 0.42, 0.4, 0.53, 0.59, 0.3],
  ],
  // Mantenimiento: estable.
  Mantenimiento: [
    [0.8, 0.78, 0.74, 0.7, 0.75, 0.82, 0.82],
    [0.8, 0.77, 0.75, 0.7, 0.76, 0.82, 0.81],
    [0.81, 0.78, 0.74, 0.71, 0.76, 0.83, 0.82],
  ],
  // Calidad y Administrativo: variación normal.
  Calidad: [
    [0.68, 0.66, 0.6, 0.58, 0.66, 0.72, 0.7],
    [0.7, 0.64, 0.58, 0.6, 0.68, 0.7, 0.68],
    [0.66, 0.68, 0.6, 0.56, 0.64, 0.72, 0.68],
  ],
  Administrativo: [
    [0.66, 0.68, 0.6, 0.6, 0.64, 0.7, 0.68],
    [0.64, 0.7, 0.62, 0.58, 0.62, 0.68, 0.66],
    [0.68, 0.66, 0.58, 0.55, 0.62, 0.7, 0.64],
  ],
};

export const targetFavorable = (area: AreaName, surveyIdx: number, dim: Dim): number =>
  T[area][surveyIdx][DIMENSIONS.indexOf(dim)];

function gauss(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Una respuesta Likert: con probabilidad p es 4 o 5; si no, 1 a 3. */
export function sampleLikert(p: number, rng: () => number): number {
  if (rng() < p) return rng() < 0.42 ? 5 : 4;
  const r = rng();
  return r < 0.45 ? 3 : r < 0.8 ? 2 : 1;
}

/** Valores de un respondente: dimension -> lista de respuestas Likert. */
export function simulateRespondent(
  area: AreaName, surveyIdx: number, questionsPerDim: number, rng: () => number,
): Record<Dim, number[]> {
  const bias = gauss(rng) * 0.07; // sesgo propio de la persona, para que no se vea artificial
  const out = {} as Record<Dim, number[]>;
  for (const d of DIMENSIONS) {
    const p = Math.min(0.97, Math.max(0.03, targetFavorable(area, surveyIdx, d) + bias + gauss(rng) * 0.04));
    out[d] = Array.from({ length: questionsPerDim }, () => sampleLikert(p, rng));
  }
  return out;
}

/** Salidas mensuales por área para los últimos 12 meses (determinista). */
export function turnoverFor(area: AreaName, rng: () => number): { headcountStart: number; exits: number; voluntaryExits: number }[] {
  return Array.from({ length: 12 }, () => {
    const exits = Math.max(0, Math.round(HEADCOUNT[area] * MONTHLY_TURNOVER[area] + (rng() - 0.5) * 2));
    return { headcountStart: HEADCOUNT[area], exits, voluntaryExits: Math.round(exits * 0.75) };
  });
}
