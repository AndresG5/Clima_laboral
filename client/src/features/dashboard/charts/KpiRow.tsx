import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { fmtDelta, fmtPct } from '../../../lib/format';
import type { Overview } from '../../../lib/types';
import { Insufficient } from '../../../components/ui';
import { Sparkline } from './Sparkline';

function DeltaTag({ delta }: { delta: number | null }) {
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const tone = delta === null ? 'text-acero' : delta > 0 ? 'text-verde-texto' : delta < 0 ? 'text-rojo-texto' : 'text-acero';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[28px] font-semibold leading-8 ${tone}`}>
      <Icon className="h-6 w-6" aria-hidden="true" />
      {fmtDelta(delta)}
    </span>
  );
}

function KpiCard({ label, value, note, spark, explain }: { label: string; value: ReactNode; note?: ReactNode; spark?: ReactNode; explain?: ReactNode }) {
  return (
    <div className="rounded-lg border border-borde-suave bg-superficie p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] leading-5 text-acero">{label}</p>
        {explain}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="tabular text-[28px] font-semibold leading-8">{value}</p>
        {spark}
      </div>
      {note && <p className="mt-1 text-[13px] leading-5 text-acero">{note}</p>}
    </div>
  );
}

export function KpiRow({ overview, globalSeries, atRiskCount, criticoCount, altoCount, explainIndex, explainRisk }: {
  overview: Overview;
  globalSeries: (number | null)[];
  atRiskCount: number;
  criticoCount: number;
  altoCount: number;
  explainIndex?: ReactNode;
  explainRisk?: ReactNode;
}) {
  const gf = overview.globalFavorable;
  const delta = overview.trend?.delta ?? null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Participación"
        value={fmtPct(overview.participation.pct)}
        note={`${overview.participation.completed} de ${overview.participation.invited} personas`}
      />
      <KpiCard
        label="Índice global de clima"
        value={!gf.suppressed && gf.value !== null ? fmtPct(gf.value) : <span className="text-base"><Insufficient /></span>}
        note="Respuestas favorables (4 o 5)"
        spark={<Sparkline data={globalSeries} />}
        explain={explainIndex}
      />
      <KpiCard
        label="Tendencia"
        value={<DeltaTag delta={delta} />}
        note={overview.trend ? `Contra ${overview.trend.previousTitle}` : 'No hay encuesta anterior'}
        spark={<Sparkline data={globalSeries} color="#5C6B73" />}
      />
      <KpiCard
        label="Áreas en riesgo alto o crítico"
        value={String(atRiskCount)}
        note={`${criticoCount} crítica${criticoCount === 1 ? '' : 's'}, ${altoCount} alta${altoCount === 1 ? '' : 's'}`}
        explain={explainRisk}
      />
    </div>
  );
}
