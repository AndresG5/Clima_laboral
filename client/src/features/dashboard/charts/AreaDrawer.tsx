import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { api, qs } from '../../../lib/api';
import { fmtDateShort, fmtPct } from '../../../lib/format';
import type { AreaDetail } from '../../../lib/types';
import type { Recommendation } from '../../../lib/recommendations';
import { Drawer } from '../../../components/Drawer';
import { RiskBadge } from '../../../components/RiskBadge';
import { ErrorNote, Insufficient, Loading } from '../../../components/ui';

export function AreaDrawer({ areaId, surveyId, onClose, recommendations }: {
  areaId: string | null; surveyId: string | undefined; onClose: () => void; recommendations: Recommendation[];
}) {
  const q = useQuery({
    queryKey: ['area-drawer', areaId, surveyId],
    queryFn: () => api.get<AreaDetail>(`/analytics/areas/${areaId}${qs({ surveyId })}`),
    enabled: !!areaId && !!surveyId,
  });
  const title = q.data?.area.name ?? 'Detalle del área';
  const mine = recommendations.filter((r) => r.areaId === areaId);

  return (
    <Drawer open={!!areaId} title={title} onClose={onClose}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorNote error={q.error} /> : q.data ? (
        q.data.suppressed ? (
          <Insufficient message={q.data.message} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              {q.data.risk ? (
                <>
                  <span className="tabular text-[28px] font-semibold leading-8">{q.data.risk.score.toFixed(1)}</span>
                  <RiskBadge level={q.data.risk.level} />
                </>
              ) : <p className="text-acero">Sin índice de riesgo para esta encuesta.</p>}
            </div>

            <div>
              <h3 className="font-semibold">Tendencia del índice</h3>
              <div
                role="img"
                aria-label={`Tendencia de ${title}: ${q.data.trend.map((t) => `${fmtDateShort(t.closesAt)} ${t.favorable === null ? 'sin dato' : `${t.favorable} %`}`).join(', ')}`}
                className="mt-2 h-20"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={q.data.trend.map((t) => ({ name: fmtDateShort(t.closesAt), v: t.favorable }))}>
                    <YAxis hide domain={[0, 100]} />
                    <Line type="monotone" dataKey="v" stroke="#1F5FBF" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="font-semibold">Dimensiones más bajas</h3>
              <ol className="mt-2 flex flex-col gap-2">
                {[...q.data.dimensions].sort((a, b) => (a.favorable ?? 100) - (b.favorable ?? 100)).slice(0, 3).map((d) => (
                  <li key={d.dimension} className="flex items-center justify-between gap-2">
                    <span>{d.label}</span>
                    <span className="tabular text-acero">{fmtPct(d.favorable)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="font-semibold">Acciones sugeridas</h3>
              {mine.length === 0 ? (
                <p className="mt-2 text-acero">Ninguna regla de riesgo se activó para esta área con la encuesta actual.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {mine.map((r) => <li key={r.id} className="text-[13px] leading-5">{r.detail}</li>)}
                </ul>
              )}
            </div>

            <Link to={`/areas/${areaId}?surveyId=${surveyId}`} className="font-medium text-azul-plano underline underline-offset-4 hover:text-azul-oscuro">
              Ver reporte completo del área
            </Link>
          </div>
        )
      ) : null}
    </Drawer>
  );
}
