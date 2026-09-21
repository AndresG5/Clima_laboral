import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Participation } from '../../../lib/types';
import { Insufficient } from '../../../components/ui';
import { VisuallyHiddenTable } from '../../../components/DataTable';

const GOAL = 80;

export function ParticipationBars({ data }: { data: Participation }) {
  const chartData = data.areas.map((a) => ({ name: a.areaName, pct: a.pct ?? 0, suppressed: a.suppressed }));
  const suppressedAreas = data.areas.filter((a) => a.suppressed);

  return (
    <div>
      <div role="img" aria-label={`Porcentaje de participación por área, contra una meta de ${GOAL} %`} className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="#CBD1D4" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v} %`} tick={{ fontSize: 12, fill: '#5C6B73' }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#16252B' }} />
            <Tooltip formatter={(v, _n, item) => [item?.payload?.suppressed ? 'Muestra insuficiente' : `${v} %`, 'Participación']} />
            <ReferenceLine x={GOAL} stroke="#E0A100" strokeDasharray="4 4" label={{ value: `Meta ${GOAL} %`, position: 'insideTopRight', fill: '#6B4B00', fontSize: 12 }} />
            <Bar dataKey="pct" fill="#1F5FBF" radius={[0, 2, 2, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {suppressedAreas.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {suppressedAreas.map((a) => <li key={a.areaId}><Insufficient message={`${a.areaName}: muestra insuficiente`} /></li>)}
        </ul>
      )}
      <VisuallyHiddenTable
        caption="Participación por área, invitados y personas que completaron la encuesta"
        columns={['Área', 'Invitados', 'Completadas', 'Porcentaje']}
        rows={data.areas.map((a) => [a.areaName, a.invited, a.suppressed ? 'Muestra insuficiente' : (a.completed ?? 0), a.suppressed ? 'Muestra insuficiente' : `${a.pct ?? 0} %`])}
      />
    </div>
  );
}
