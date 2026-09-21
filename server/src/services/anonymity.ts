import type { TenureBand } from '@prisma/client';

export const INSUFFICIENT_MESSAGE = 'Muestra insuficiente para proteger el anonimato';

export const meetsK = (n: number, k: number): boolean => n >= k;

export type Guarded<T> = { suppressed: false; value: T } | { suppressed: true; message: string };

/** Devuelve el valor solo si el grupo tiene al menos k respuestas. */
export function guard<T>(n: number, k: number, produce: () => T): Guarded<T> {
  return meetsK(n, k) ? { suppressed: false, value: produce() } : { suppressed: true, message: INSUFFICIENT_MESSAGE };
}

/**
 * Supresión secundaria. Si exactamente un corte queda oculto y el total sí se
 * muestra, podría deducirse restando los demás. Para evitarlo también se oculta
 * el corte visible más pequeño. Devuelve las claves que deben ocultarse.
 */
export function suppressedKeys(counts: Record<string, number>, k: number): Set<string> {
  const out = new Set<string>();
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  for (const [key, n] of entries) if (n < k) out.add(key);
  if (out.size === 1) {
    const visible = entries.filter(([key]) => !out.has(key)).sort((a, b) => a[1] - b[1]);
    if (visible.length > 0) out.add(visible[0][0]);
  }
  return out;
}

export function tenureBandFor(hireDate: Date, on: Date): TenureBand {
  const months = (on.getFullYear() - hireDate.getFullYear()) * 12 + (on.getMonth() - hireDate.getMonth());
  if (months < 6) return 'MENOS_6M';
  if (months < 12) return 'DE_6M_A_1A';
  if (months < 36) return 'DE_1A_A_3A';
  return 'MAS_3A';
}

/** Solo la fecha (sin hora), en UTC, para evitar correlaciones por horario. */
export function dateOnly(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export const TENURE_LABELS: Record<TenureBand, string> = {
  MENOS_6M: 'Menos de 6 meses',
  DE_6M_A_1A: '6 meses a 1 año',
  DE_1A_A_3A: '1 a 3 años',
  MAS_3A: 'Más de 3 años',
};
