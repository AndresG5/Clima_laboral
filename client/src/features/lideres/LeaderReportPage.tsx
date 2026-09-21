import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, qs } from '../../lib/api';
import type { Report360 } from '../../lib/types';
import { EmptyState } from '../../components/EmptyState';
import { SurveySelect, useSurveys } from '../../components/SurveySelect';
import { ErrorNote, Insufficient, Loading, PageHeader, Panel } from '../../components/ui';
import { useMe } from '../auth/useAuth';

const AXIS = { fontSize: 12, fill: '#5C6B73' };
const num = (n: number | null) => (n === null ? null : n.toFixed(2));
const gapText = (n: number | null) => (n === null ? null : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}`);

export function LeadersPage() {
  const q = useQuery({ queryKey: ['leaders'], queryFn: () => api.get<{ leaders: { id: string; name: string; areaName: string }[] }>('/leaders') });
  return (
    <>
      <PageHeader title="Líderes">Elige a un líder para ver su reporte 360.</PageHeader>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorNote error={q.error} /> : (
        <Panel>
          <ul className="divide-y divide-borde-suave">
            {q.data!.leaders.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div><p className="font-semibold">{l.name}</p><p className="text-[13px] leading-5 text-acero">{l.areaName}</p></div>
                <Link to={`/lideres/${l.id}`} className="font-medium text-azul-plano underline underline-offset-4">Ver reporte 360</Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

export function LeaderReportPage({ own = false }: { own?: boolean }) {
  const me = useMe().data;
  const params = useParams();
  const leaderId = own ? me?.id : params.id;
  const surveys = useSurveys('EVAL_360', own);
  const [picked, setPicked] = useState<string>();
  const surveyId = picked ?? surveys.data?.[0]?.id;
  const q = useQuery({
    queryKey: ['report360', leaderId, surveyId],
    queryFn: () => api.get<Report360>(`/leaders/${leaderId}/report360${qs({ surveyId })}`),
    enabled: !!leaderId && !!surveyId,
  });

  if (surveys.isLoading) return <Loading />;
  if (!surveys.data || surveys.data.length === 0) {
    return (<><PageHeader title={own ? 'Mi reporte 360' : 'Reporte 360'} /><EmptyState title="Aún no hay evaluaciones 360 cerradas">El reporte aparece cuando RH cierra una evaluación 360.</EmptyState></>);
  }
  const select = <SurveySelect type="EVAL_360" value={surveyId} onChange={setPicked} onlyClosed={own} />;
  if (q.isLoading) return <><PageHeader title={own ? 'Mi reporte 360' : 'Reporte 360'} actions={select} /><Loading /></>;
  if (q.isError) return <><PageHeader title={own ? 'Mi reporte 360' : 'Reporte 360'} actions={select} /><ErrorNote error={q.error} /></>;
  const r = q.data!;
  const chart = r.dimensions.map((d) => ({ name: d.label, Autoevaluación: d.auto, Equipo: d.team, Pares: d.peers }));

  return (
    <>
      <PageHeader title={own ? 'Mi reporte 360' : `Reporte 360: ${r.leader.name}`} actions={select}>
        {r.leader.areaName}. {r.survey.title}. {!own && <Link to="/lideres" className="text-azul-plano underline underline-offset-4">Volver a líderes</Link>}
      </PageHeader>
      <div className="grid grid-cols-1 gap-6">
        <Panel title="Quién respondió">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {r.groups.map((g) => (
              <li key={g.relation}>
                <p className="text-[13px] leading-5 text-acero">{g.label}</p>
                <p className="tabular text-[32px] font-semibold leading-9">{g.suppressed ? <span className="text-base font-normal"><Insufficient message={g.message} /></span> : g.responses}</p>
              </li>
            ))}
          </ul>
          <p className="measure mt-3 text-[13px] leading-5 text-acero">Equipo y pares se muestran solo con {r.survey.minGroupSize} respuestas o más. La autoevaluación es tuya y no requiere umbral.</p>
        </Panel>

        <Panel title="Autoevaluación contra percepción del equipo y de los pares">
          <div role="img" aria-label="Promedio de 1 a 5 por dimensión, según autoevaluación, equipo y pares" className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#CBD1D4" />
                <XAxis dataKey="name" tick={AXIS} interval={0} />
                <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={AXIS} width={28} />
                <Tooltip />
                <Legend formatter={(v: string) => <span style={{ color: '#16252B' }}>{v}</span>} />
                <Bar dataKey="Autoevaluación" fill="#16252B" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Equipo" fill="#1F5FBF" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Pares" fill="#93CDB3" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Brecha por dimensión">
          <div className="overflow-x-auto">
            <table className="tabular w-full min-w-[640px] text-left">
              <thead>
                <tr className="text-[13px] text-acero">
                  <th scope="col" className="pb-2 font-medium">Dimensión</th>
                  <th scope="col" className="pb-2 text-right font-medium">Autoevaluación</th>
                  <th scope="col" className="pb-2 text-right font-medium">Equipo</th>
                  <th scope="col" className="pb-2 text-right font-medium">Pares</th>
                  <th scope="col" className="pb-2 text-right font-medium">Brecha con equipo</th>
                  <th scope="col" className="pb-2 text-right font-medium">Brecha con pares</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde-suave">
                {r.dimensions.map((d) => (
                  <tr key={d.dimension}>
                    <th scope="row" className="py-2 pr-2 font-normal">{d.label}</th>
                    <td className="py-2 text-right">{num(d.auto) ?? 'Sin dato'}</td>
                    <td className="py-2 text-right">{num(d.team) ?? <Insufficient message="Insuficiente" />}</td>
                    <td className="py-2 text-right">{num(d.peers) ?? <Insufficient message="Insuficiente" />}</td>
                    <td className={`py-2 text-right ${d.gapTeam !== null && d.gapTeam >= 1 ? 'font-semibold text-rojo-texto' : ''}`}>{gapText(d.gapTeam) ?? 'Sin dato'}</td>
                    <td className={`py-2 text-right ${d.gapPeers !== null && d.gapPeers >= 1 ? 'font-semibold text-rojo-texto' : ''}`}>{gapText(d.gapPeers) ?? 'Sin dato'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="measure mt-3 text-[13px] leading-5 text-acero">Escala de 1 a 5. Una brecha positiva significa que la autoevaluación es más alta que la percepción de los demás; a partir de 1.00 punto conviene conversarla.</p>
        </Panel>
      </div>
    </>
  );
}
