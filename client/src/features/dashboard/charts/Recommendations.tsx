import { Eye, OctagonAlert, TriangleAlert } from 'lucide-react';
import type { Recommendation, Severity } from '../../../lib/recommendations';

const ICON: Record<Severity, typeof Eye> = { CRITICO: OctagonAlert, ALTO: TriangleAlert, MEDIO: Eye };
const BOX_CLS: Record<Severity, string> = {
  CRITICO: 'border-rojo-paro bg-rojo-tinte', ALTO: 'border-rojo-paro bg-rojo-tinte', MEDIO: 'border-ambar-texto bg-ambar-tinte',
};
const ICON_CLS: Record<Severity, string> = { CRITICO: 'text-rojo-texto', ALTO: 'text-rojo-texto', MEDIO: 'text-ambar-texto' };

export function Recommendations({ items, onSelectArea }: { items: Recommendation[]; onSelectArea: (areaId: string) => void }) {
  if (items.length === 0) {
    return <p className="text-acero">Ninguna regla de riesgo se activó con los datos de esta encuesta.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {items.map((r) => {
        const Icon = ICON[r.severity];
        return (
          <li key={r.id} className={`rounded-lg border p-3 ${BOX_CLS[r.severity]}`}>
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_CLS[r.severity]}`} aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold leading-5">{r.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-tinta">{r.detail}</p>
                <button type="button" onClick={() => onSelectArea(r.areaId)} className="mt-2 rounded-sm text-[13px] font-medium text-azul-plano underline underline-offset-4 hover:text-azul-oscuro">
                  Ver {r.areaName}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
