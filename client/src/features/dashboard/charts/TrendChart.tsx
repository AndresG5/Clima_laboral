import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDateShort } from '../../../lib/format';
import type { TrendAll } from '../../../lib/types';
import { Select } from '../../../components/ui';
import { VisuallyHiddenTable } from '../../../components/DataTable';

const PALETTE = ['#1F5FBF', '#1E7F5C', '#E0A100', '#C8382B', '#5C6B73', '#184C9A', '#9E2A20'];
const GLOBAL = '__global__';

export function TrendChart({ data }: { data: TrendAll }) {
  const [highlight, setHighlight] = useState<string>(GLOBAL);
  const points = data.points.map((p) => {
    const row: Record<string, number | null | string> = { name: fmtDateShort(p.closesAt), global: p.global };
    for (const a of p.areas) row[a.areaId] = a.favorable;
    return row;
  });
  const options = [{ id: GLOBAL, name: 'Índice global' }, ...data.areas.map((a) => ({ id: a.id, name: a.name }))];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor="trend-highlight" className="text-[13px] text-acero">Resaltar</label>
        <Select id="trend-highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} className="!w-auto min-w-48">
          {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
      </div>
      <div role="img" aria-label="Tendencia del índice de clima favorable, global y por área, a lo largo de las encuestas cerradas" className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#CBD1D4" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5C6B73' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#5C6B73' }} width={32} />
            <Tooltip formatter={(v) => (v === null || v === undefined ? 'Sin dato' : `${v} %`)} />
            <Line
              type="monotone" dataKey="global" name="Índice global"
              stroke={highlight === GLOBAL ? '#16252B' : '#CBD1D4'} strokeWidth={highlight === GLOBAL ? 3 : 1.5}
              dot={{ r: highlight === GLOBAL ? 3 : 2 }} isAnimationActive={false} connectNulls
            />
            {data.areas.map((a, i) => (
              <Line
                key={a.id} type="monotone" dataKey={a.id} name={a.name}
                stroke={highlight === a.id ? PALETTE[i % PALETTE.length] : '#E3E7E8'} strokeWidth={highlight === a.id ? 3 : 1.25}
                dot={{ r: highlight === a.id ? 3 : 1.5 }} isAnimationActive={false} connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <VisuallyHiddenTable
        caption="Índice de clima favorable por encuesta, global y por área"
        columns={['Encuesta', 'Global', ...data.areas.map((a) => a.name)]}
        rows={data.points.map((p) => [
          p.title,
          p.global === null ? 'Sin dato' : `${p.global} %`,
          ...p.areas.map((a) => (a.suppressed ? 'Muestra insuficiente' : a.favorable === null ? 'Sin dato' : `${a.favorable} %`)),
        ])}
      />
    </div>
  );
}
