import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const d = (v: string | Date) => (typeof v === 'string' ? parseISO(v) : v);

export const fmtDate = (v: string | Date | null | undefined): string => (v ? format(d(v), "d 'de' MMM yyyy", { locale: es }) : 'Sin fecha');
export const fmtDateShort = (v: string | Date | null | undefined): string => (v ? format(d(v), 'MMM yyyy', { locale: es }) : 'Sin fecha');
export const fmtPct = (n: number | null | undefined, digits = 0): string =>
  n === null || n === undefined ? 'Sin dato' : `${n.toFixed(digits)} %`;
export const fmtDelta = (n: number | null | undefined): string =>
  n === null || n === undefined ? 'Sin dato' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)} pts`;
