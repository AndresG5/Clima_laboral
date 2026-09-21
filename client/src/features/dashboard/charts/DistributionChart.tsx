import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DIMENSIONS } from '../../../lib/constants';
import { VisuallyHiddenTable } from '../../../components/DataTable';

interface Cell { dimension: string; favorable: number | null; neutral: number | null; desfavorable: number | null }

export function DistributionChart({ cells, title }: { cells: Cell[]; title: string }) {
  const data = DIMENSIONS.map(([key, label]) => {
    const c = cells.find((x) => x.dimension === key);
    return { label, Desfavorable: c?.desfavorable ?? 0, Neutral: c?.neutral ?? 0, Favorable: c?.favorable ?? 0 };
  });
  return (
    <div>
      <div role="img" aria-label={`Distribución de respuestas desfavorables, neutrales y favorables por dimensión, ${title}`} className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid horizontal={false} stroke="#CBD1D4" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v} %`} tick={{ fontSize: 12, fill: '#5C6B73' }} />
            <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12, fill: '#16252B' }} />
            <Tooltip formatter={(v, name) => [`${Math.round(Number(v))} %`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Desfavorable" stackId="d" fill="#C8382B" isAnimationActive={false} />
            <Bar dataKey="Neutral" stackId="d" fill="#E0A100" isAnimationActive={false} />
            <Bar dataKey="Favorable" stackId="d" fill="#1E7F5C" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHiddenTable
        caption={`Distribución de respuestas por dimensión, ${title}`}
        columns={['Dimensión', 'Desfavorable', 'Neutral', 'Favorable']}
        rows={data.map((d) => [d.label, `${Math.round(d.Desfavorable)} %`, `${Math.round(d.Neutral)} %`, `${Math.round(d.Favorable)} %`])}
      />
    </div>
  );
}
