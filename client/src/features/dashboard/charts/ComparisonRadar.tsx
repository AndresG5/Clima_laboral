import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DIMENSIONS } from '../../../lib/constants';
import type { Heatmap } from '../../../lib/types';
import { VisuallyHiddenTable } from '../../../components/DataTable';

export function ComparisonRadar({ heat, areaId }: { heat: Heatmap; areaId: string | null }) {
  const row = areaId ? heat.rows.find((r) => r.areaId === areaId) : null;
  const areaName = row ? row.areaName : null;
  const areaOk = !!row && !row.suppressed;

  const data = DIMENSIONS.map(([key, label]) => {
    const company = heat.companyAverage.find((c) => c.dimension === key)?.favorable ?? null;
    const areaVal = areaOk ? (row as Extract<typeof row, { suppressed: false }>).cells.find((c) => c.dimension === key)?.favorable ?? null : null;
    return { label, Empresa: company ?? 0, Área: areaVal ?? 0 };
  });

  return (
    <div>
      <div
        role="img"
        aria-label={areaName ? `Comparación de ${areaName} contra el promedio de la empresa por dimensión` : 'Elige un área en el filtro para compararla contra el promedio de la empresa'}
        className="h-80"
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#CBD1D4" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#5C6B73' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5C6B73' }} />
            <Tooltip formatter={(v) => `${Math.round(Number(v))} %`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Radar name="Empresa" dataKey="Empresa" stroke="#5C6B73" fill="#5C6B73" fillOpacity={0.15} isAnimationActive={false} />
            {areaOk && <Radar name={areaName!} dataKey="Área" stroke="#1F5FBF" fill="#1F5FBF" fillOpacity={0.3} isAnimationActive={false} />}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {!areaOk && <p className="mt-2 text-[13px] text-acero">Elige un área en el filtro de arriba para compararla contra el promedio de la empresa.</p>}
      <VisuallyHiddenTable
        caption="Porcentaje favorable por dimensión: empresa y área seleccionada"
        columns={['Dimensión', 'Empresa', areaName ?? 'Área']}
        rows={data.map((d) => [d.label, `${Math.round(d.Empresa)} %`, areaOk ? `${Math.round(d.Área)} %` : 'Sin selección'])}
      />
    </div>
  );
}
