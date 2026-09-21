import { CircleCheck, Eye, OctagonAlert, TriangleAlert } from 'lucide-react';
import { LEVEL_LABELS } from '../lib/constants';
import type { Level } from '../lib/types';

const cfg: Record<Level, { cls: string; icon: typeof Eye; iconCls: string }> = {
  BAJO: { cls: 'bg-verde-tinte border-verde-seguridad text-tinta', icon: CircleCheck, iconCls: 'text-verde-texto' },
  MEDIO: { cls: 'bg-ambar-tinte border-ambar-texto text-tinta', icon: Eye, iconCls: 'text-ambar-texto' },
  ALTO: { cls: 'bg-rojo-tinte border-rojo-paro text-tinta', icon: TriangleAlert, iconCls: 'text-rojo-texto' },
  CRITICO: { cls: 'bg-rojo-paro border-rojo-paro text-white font-semibold', icon: OctagonAlert, iconCls: 'text-white' },
};

/** Nunca solo color: color + etiqueta de texto + icono SVG. */
export function RiskBadge({ level }: { level: Level }) {
  const { cls, icon: Icon, iconCls } = cfg[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[13px] font-medium leading-5 ${cls}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconCls}`} aria-hidden="true" />
      {LEVEL_LABELS[level]}
    </span>
  );
}
