import type { Overview } from '../../../lib/types';
import { RiskBadge } from '../../../components/RiskBadge';
import { Insufficient } from '../../../components/ui';

const BAR_CLS: Record<string, string> = {
  CRITICO: 'bg-rojo-paro', ALTO: 'bg-rojo-paro', MEDIO: 'bg-ambar-aviso', BAJO: 'bg-verde-seguridad',
};

export function RiskRanking({ areas }: { areas: Overview['areas'] }) {
  const ranked = [...areas].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ranked.map((a) => (
        <li key={a.areaId} className="rounded-md border border-borde-suave p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{a.areaName}</span>
            {a.level ? <RiskBadge level={a.level} /> : <Insufficient />}
          </div>
          {a.score !== null ? (
            <>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2.5 flex-1 rounded-sm bg-concreto" role="img" aria-label={`Índice de riesgo: ${a.score.toFixed(1)} de 100`}>
                  <div className={`h-2.5 rounded-sm ${BAR_CLS[a.level ?? 'BAJO']}`} style={{ width: `${Math.min(100, a.score)}%` }} />
                </div>
                <span className="tabular w-12 text-right text-[13px] text-acero">{a.score.toFixed(1)}</span>
              </div>
              {a.drivers[0] && <p className="mt-1.5 text-[13px] leading-5 text-acero">Factor principal: {a.drivers[0].label.toLowerCase()} (+{a.drivers[0].contribution.toFixed(1)} pts)</p>}
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
