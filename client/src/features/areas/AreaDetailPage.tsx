import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, qs } from '../../lib/api';
import { fmtDateShort, fmtPct } from '../../lib/format';
import type { AreaDetail } from '../../lib/types';
import { EmptyState } from '../../components/EmptyState';
import { RiskBadge } from '../../components/RiskBadge';
import { SurveySelect, useSurveys } from '../../components/SurveySelect';
import { ErrorNote, Insufficient, Loading, PageHeader, Panel, Stat } from '../../components/ui';
import { useMe } from '../auth/useAuth';

const AXIS = { fontSize: 12, fill: '#5C6B73' };

export function AreaDetailPage({ own = false }: { own?: boolean }) {
  const me = useMe().data;
  const params = useParams();
  const [sp, setSp] = useSearchParams();
  const areaId = own ? me?.area.id : params.id;
  const surveys = useSurveys('CLIMA', own);
  const surveyId = sp.get('surveyId') ?? surveys.data?.[0]?.id;
  const q = useQuery({
    queryKey: ['area', areaId, surveyId],
    queryFn: () => api.get<AreaDetail>(`/analytics/areas/${areaId}${qs({ surveyId })}`),
    enabled: !!areaId && !!surveyId,
  });

  if (surveys.isLoading) return <Loading />;
  if (!surveys.data || surveys.data.length === 0) {
    return (
      <>
        <PageHeader title={own ? 'Mi equipo' : 'Detalle del área'} />
        <EmptyState title="Aún no hay resultados">Los resultados aparecen cuando RH cierra una encuesta de clima.</EmptyState>
      </>
    );
  }
  const select = <SurveySelect type="CLIMA" value={surveyId} onChange={(id) => setSp({ surveyId: id })} onlyClosed={own} />;
  if (q.isLoading) return <><PageHeader title={own ? 'Mi equipo' : 'Detalle del área'} actions={select} /><Loading /></>;
  if (q.isError) return <><PageHeader title={own ? 'Mi equipo' : 'Detalle del área'} actions={select} /><ErrorNote error={q.error} /></>;
  const d = q.data!;
  const title = own ? `Mi equipo: ${d.area.name}` : d.area.name;

  if (d.suppressed) {
    return (
      <>
        <PageHeader title={title} actions={select}>{d.survey.title}</PageHeader>
        <Panel><div className="flex flex-col gap-2"><Insufficient message={d.message} /><p className="measure text-acero">Esta área tiene menos respuestas que el mínimo de {d.survey.minGroupSize} para mostrar resultados sin poner en riesgo el anonimato.</p></div></Panel>
      </>
    );
  }
  const trend = d.trend.map((p) => ({ name: fmtDateShort(p.closesAt), favorable: p.favorable }));
  const back = !own && <Link to="/dashboard" className="text-azul-plano underline underline-offset-4">Volver al panel</Link>;

  return (
    <>
      <PageHeader title={title} actions={select}>{d.survey.title}. {back}</PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Riesgo de rotación" className="lg:col-span-1">
          {d.risk ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="tabular text-[32px] font-semibold leading-9">{d.risk.score.toFixed(1)}</span>
                <RiskBadge level={d.risk.level} />
              </div>
              <div>
                <h3 className="font-semibold">Qué atender primero</h3>
                <ol className="mt-2 flex flex-col gap-2">
                  {d.risk.drivers.map((dr) => (
                    <li key={dr.key}>
                      <div className="flex justify-between gap-2"><span>{dr.label}</span><span className="tabular text-acero">+{dr.contribution.toFixed(1)} pts</span></div>
                      <div className="mt-1 h-2 rounded-sm bg-concreto"><div className="h-2 rounded-sm bg-acero" style={{ width: `${Math.min(100, (dr.contribution / d.risk!.drivers[0].contribution) * 100)}%` }} /></div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : <p className="text-acero">No hay índice de riesgo para esta encuesta.</p>}
        </Panel>

        <Panel title="Resumen" className="lg:col-span-2">
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Stat label="Respuestas" value={d.responses} note="Personas del área que respondieron" />
            <Stat label="Índice de clima" value={fmtPct(d.globalFavorable)} note="Respuestas favorables (4 o 5)" />
            <Stat label="Umbral de anonimato" value={d.survey.minGroupSize} note="Respuestas mínimas por corte" />
          </dl>
        </Panel>

        <Panel title="Dimensiones: % favorable" className="lg:col-span-2">
          <div role="img" aria-label={`Porcentaje favorable por dimensión: ${d.dimensions.map((x) => `${x.label} ${x.favorable ?? 'sin dato'}`).join(', ')}`} className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.dimensions} layout="vertical" margin={{ left: 8, right: 40 }}>
                <CartesianGrid horizontal={false} stroke="#CBD1D4" />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v} %`} />
                <YAxis type="category" dataKey="label" width={120} tick={{ ...AXIS, fill: '#16252B' }} />
                <Tooltip formatter={(v) => `${v} %`} />
                <Bar dataKey="favorable" fill="#1F5FBF" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                  <LabelList dataKey="favorable" position="right" formatter={(v) => `${Math.round(Number(v))} %`} style={{ fontSize: 12, fill: '#16252B' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Tendencia entre encuestas" className="lg:col-span-1">
          <div role="img" aria-label={`Índice de clima por encuesta: ${trend.map((t) => `${t.name} ${t.favorable ?? 'sin dato'}`).join(', ')}`} className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 0, right: 16, top: 24 }}>
                <CartesianGrid vertical={false} stroke="#CBD1D4" />
                <XAxis dataKey="name" tick={AXIS} />
                <YAxis domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v}`} width={32} />
                <Tooltip formatter={(v) => `${v} %`} />
                <Line type="monotone" dataKey="favorable" name="Favorable" stroke="#1F5FBF" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false}>
                  <LabelList dataKey="favorable" position="top" offset={12} formatter={(v) => `${Math.round(Number(v))} %`} style={{ fontSize: 12, fill: '#16252B' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Por antigüedad" className="lg:col-span-1">
          <table className="tabular w-full text-left">
            <thead><tr className="text-[13px] text-acero"><th scope="col" className="pb-2 font-medium">Antigüedad</th><th scope="col" className="pb-2 text-right font-medium">Favorable</th></tr></thead>
            <tbody className="divide-y divide-borde-suave">
              {d.tenure.map((t) => (
                <tr key={t.band}>
                  <th scope="row" className="py-2 pr-2 font-normal">{t.label}</th>
                  <td className="py-2 text-right">{t.suppressed ? <Insufficient message="Muestra insuficiente" /> : <>{fmtPct(t.favorable)} <span className="text-[13px] text-acero">({t.responses})</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[13px] leading-5 text-acero">Un corte se oculta si tiene menos de {d.survey.minGroupSize} respuestas. Cuando solo uno se oculta, también se oculta el menor de los visibles para que no pueda deducirse.</p>
        </Panel>

        {d.risk && (
          <Panel title="Cómo se calculó el índice" className="lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="tabular w-full min-w-[480px] text-left">
                <thead><tr className="text-[13px] text-acero"><th scope="col" className="pb-2 font-medium">Componente</th><th scope="col" className="pb-2 text-right font-medium">Peso</th><th scope="col" className="pb-2 text-right font-medium">Valor (0 a 100)</th><th scope="col" className="pb-2 text-right font-medium">Aporta</th></tr></thead>
                <tbody className="divide-y divide-borde-suave">
                  {d.risk.components.map((c) => (
                    <tr key={c.key}><th scope="row" className="py-2 pr-2 font-normal">{c.label}</th><td className="py-2 text-right">{c.weight} %</td><td className="py-2 text-right">{c.raw.toFixed(1)}</td><td className="py-2 text-right font-semibold">{c.contribution.toFixed(1)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="measure mt-3 text-[13px] leading-5 text-acero">Índice ponderado y explicable, no aprendizaje automático. Los pesos son supuestos de trabajo y no están calibrados con datos reales.</p>
          </Panel>
        )}

        <Panel title="Comentarios abiertos" className="lg:col-span-1">
          {d.comments.length === 0 ? <p className="text-acero">Nadie dejó comentarios en esta encuesta.</p> : (
            <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
              {d.comments.map((c, i) => <li key={i} className="measure border-b border-borde-suave pb-3 last:border-0">{c}</li>)}
            </ul>
          )}
          <p className="mt-3 text-[13px] leading-5 text-acero">Sin fecha ni autor, en orden alfabético.</p>
        </Panel>
      </div>
    </>
  );
}
