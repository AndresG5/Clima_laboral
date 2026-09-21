import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { buildRecommendations } from '../../lib/recommendations';
import type { Heatmap as HeatmapData, Overview, Participation, RiskConfig, TrendAll } from '../../lib/types';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ExplainPopover } from '../../components/ExplainPopover';
import { Heatmap } from '../../components/Heatmap';
import { SurveySelect, useSurveys } from '../../components/SurveySelect';
import { ErrorNote, Field, Insufficient, Loading, PageHeader, Panel, Select } from '../../components/ui';
import { AreaDrawer } from './charts/AreaDrawer';
import { ComparisonRadar } from './charts/ComparisonRadar';
import { DistributionChart } from './charts/DistributionChart';
import { KpiRow } from './charts/KpiRow';
import { ParticipationBars } from './charts/ParticipationBars';
import { Recommendations } from './charts/Recommendations';
import { RiskRanking } from './charts/RiskRanking';
import { TrendChart } from './charts/TrendChart';

export function DashboardPage() {
  const surveys = useSurveys('CLIMA');
  const [picked, setPicked] = useState<string>();
  const surveyId = picked ?? surveys.data?.[0]?.id;

  const heat = useQuery({ queryKey: ['heatmap', surveyId], queryFn: () => api.get<HeatmapData>(`/analytics/heatmap${qs({ surveyId })}`), enabled: !!surveyId });
  const overview = useQuery({ queryKey: ['overview', surveyId], queryFn: () => api.get<Overview>(`/analytics/overview${qs({ surveyId })}`), enabled: !!surveyId });
  const trendAll = useQuery({ queryKey: ['trend-all'], queryFn: () => api.get<TrendAll>('/analytics/trend-all') });
  const participation = useQuery({ queryKey: ['participation', surveyId], queryFn: () => api.get<Participation>(`/analytics/participation${qs({ surveyId })}`), enabled: !!surveyId });
  const riskConfig = useQuery({ queryKey: ['risk-config'], queryFn: () => api.get<RiskConfig>('/config/risk') });

  const [areaFilter, setAreaFilter] = useState('');
  const [dimFilter, setDimFilter] = useState('');
  const [drawerAreaId, setDrawerAreaId] = useState<string | null>(null);

  const recommendations = useMemo(
    () => (heat.data && overview.data ? buildRecommendations(heat.data, overview.data.areas) : []),
    [heat.data, overview.data],
  );

  if (surveys.isLoading) return <Loading />;
  if (surveys.isError) return <ErrorNote error={surveys.error} />;
  if (!surveys.data || surveys.data.length === 0) {
    return (
      <>
        <PageHeader title="Panel de clima laboral" />
        <EmptyState title="Aún no hay encuestas de clima" action={<Link to="/encuestas" className="inline-flex min-h-10 items-center rounded-md bg-azul-plano px-4 py-2 font-medium text-white hover:bg-azul-oscuro">Crear encuesta</Link>}>
          Crea y activa una encuesta para empezar a medir el clima laboral de cada área.
        </EmptyState>
      </>
    );
  }

  const o = overview.data;
  const globalSeries = trendAll.data?.points.map((p) => p.global) ?? [];
  const criticoCount = o?.areas.filter((a) => a.level === 'CRITICO').length ?? 0;
  const altoCount = o?.areas.filter((a) => a.level === 'ALTO').length ?? 0;
  const selectedRow = areaFilter ? heat.data?.rows.find((r) => r.areaId === areaFilter) ?? null : null;
  const distributionCells = selectedRow && !selectedRow.suppressed ? selectedRow.cells : heat.data?.companyAverage ?? [];
  const distributionTitle = selectedRow && !selectedRow.suppressed ? selectedRow.areaName : 'toda la empresa';

  function exportCsv() {
    if (!heat.data || !o) return;
    const rows: (string | number | null)[][] = [
      ['Panel de clima laboral', o.survey.title],
      [],
      ['Participación', `${o.participation.pct} %`, `${o.participation.completed} de ${o.participation.invited}`],
      ['Índice global', o.globalFavorable.suppressed ? 'Muestra insuficiente' : `${o.globalFavorable.value} %`],
      ['Tendencia', o.trend ? `${o.trend.delta ?? 'Sin dato'} pts vs ${o.trend.previousTitle}` : 'Sin encuesta anterior'],
      [],
      ['Área', ...heat.data.dimensions.map((d) => d.label), 'Riesgo (0-100)', 'Nivel de riesgo'],
    ];
    for (const row of heat.data.rows) {
      const risk = o.areas.find((a) => a.areaId === row.areaId);
      if (row.suppressed) {
        rows.push([row.areaName, ...heat.data.dimensions.map(() => 'Muestra insuficiente'), '', '']);
        continue;
      }
      rows.push([
        row.areaName,
        ...heat.data.dimensions.map((d) => row.cells.find((c) => c.dimension === d.dimension)?.favorable ?? 'Sin dato'),
        risk?.score ?? '', risk?.level ?? '',
      ]);
    }
    downloadCsv(`panel-clima-${o.survey.id}.csv`, rows);
  }

  return (
    <>
      <PageHeader
        title="Panel de clima laboral"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <SurveySelect type="CLIMA" value={surveyId} onChange={setPicked} />
            <Button variant="secondary" onClick={exportCsv} disabled={!heat.data || !o} icon={<Download className="h-4 w-4" aria-hidden="true" />}>Exportar CSV</Button>
          </div>
        }
      >
        {o ? `${o.survey.title}. Cierre: ${fmtDate(o.survey.closesAt)}.` : 'Porcentaje de respuestas favorables por área y dimensión.'}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <Field label="Área">
          {(id) => (
            <Select id={id} value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="!w-auto min-w-48">
              <option value="">Todas las áreas</option>
              {heat.data?.rows.map((r) => <option key={r.areaId} value={r.areaId}>{r.areaName}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Dimensión">
          {(id) => (
            <Select id={id} value={dimFilter} onChange={(e) => setDimFilter(e.target.value)} className="!w-auto min-w-48">
              <option value="">Todas las dimensiones</option>
              {heat.data?.dimensions.map((d) => <option key={d.dimension} value={d.dimension}>{d.label}</option>)}
            </Select>
          )}
        </Field>
      </div>

      {overview.isLoading ? <Loading /> : overview.isError ? <ErrorNote error={overview.error} /> : o ? (
        <KpiRow
          overview={o} globalSeries={globalSeries} atRiskCount={criticoCount + altoCount} criticoCount={criticoCount} altoCount={altoCount}
          explainIndex={
            <ExplainPopover label="el índice global">
              <p className="font-semibold">¿Cómo se calcula?</p>
              <p className="mt-1">Porcentaje de respuestas con valor 4 o 5 (de acuerdo o muy de acuerdo) sobre el total de respuestas de la encuesta. Escala de 0 a 100.</p>
            </ExplainPopover>
          }
          explainRisk={riskConfig.data ? (
            <ExplainPopover label="el riesgo de rotación">
              <p className="font-semibold">¿Cómo se calcula?</p>
              <p className="mt-1">Índice ponderado de 0 a 100 por área (no es aprendizaje automático):</p>
              <ul className="mt-1 list-disc pl-4">
                {Object.entries(riskConfig.data.weights).map(([k, v]) => <li key={k}>{riskConfig.data!.labels[k]}: {v} %</li>)}
              </ul>
              <p className="mt-1">Niveles: menos de {riskConfig.data.levels.medio} bajo, desde {riskConfig.data.levels.medio} en observación, desde {riskConfig.data.levels.alto} alto y desde {riskConfig.data.levels.critico} crítico. Solo alto y crítico generan alerta.</p>
            </ExplainPopover>
          ) : null}
        />
      ) : null}

      <div className="mt-6 grid grid-cols-12 gap-6">
        <Panel title="Mapa de calor: % favorable por área y dimensión" className="col-span-12 xl:col-span-8">
          {heat.isLoading ? <Loading /> : heat.isError ? <ErrorNote error={heat.error} /> : heat.data ? (
            <Heatmap key={heat.data.survey.id} data={heat.data} selectedAreaId={areaFilter || null} dimensionFilter={dimFilter || null} onSelectArea={setDrawerAreaId} />
          ) : null}
        </Panel>

        <Panel title="Qué atender primero" className="col-span-12 xl:col-span-4">
          {heat.isLoading || overview.isLoading ? <Loading /> : heat.isError ? <ErrorNote error={heat.error} /> : overview.isError ? <ErrorNote error={overview.error} /> : (
            <Recommendations items={recommendations} onSelectArea={setDrawerAreaId} />
          )}
        </Panel>

        <Panel title="Tendencia por trimestre" className="col-span-12 lg:col-span-6">
          {trendAll.isLoading ? <Loading /> : trendAll.isError ? <ErrorNote error={trendAll.error} /> : trendAll.data ? <TrendChart data={trendAll.data} /> : null}
        </Panel>

        <Panel title={`Distribución por dimensión: ${distributionTitle}`} className="col-span-12 lg:col-span-6">
          {heat.isLoading ? <Loading /> : heat.isError ? <ErrorNote error={heat.error} /> : selectedRow && selectedRow.suppressed ? (
            <Insufficient message={selectedRow.message} />
          ) : heat.data ? <DistributionChart cells={distributionCells} title={distributionTitle} /> : null}
        </Panel>

        <Panel title="Área vs. promedio de la empresa" className="col-span-12 lg:col-span-5">
          {heat.isLoading ? <Loading /> : heat.isError ? <ErrorNote error={heat.error} /> : heat.data ? <ComparisonRadar heat={heat.data} areaId={areaFilter || null} /> : null}
        </Panel>

        <Panel title="Participación por área" className="col-span-12 lg:col-span-7">
          {participation.isLoading ? <Loading /> : participation.isError ? <ErrorNote error={participation.error} /> : participation.data ? <ParticipationBars data={participation.data} /> : null}
        </Panel>

        <Panel title="Ranking de riesgo de rotación" className="col-span-12">
          {overview.isLoading ? <Loading /> : overview.isError ? <ErrorNote error={overview.error} /> : o ? <RiskRanking areas={o.areas} /> : null}
        </Panel>
      </div>

      <AreaDrawer areaId={drawerAreaId} surveyId={surveyId} onClose={() => setDrawerAreaId(null)} recommendations={recommendations} />
    </>
  );
}
