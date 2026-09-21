import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';

/** Mini gráfica decorativa junto a un KPI. El número real siempre va escrito aparte. */
export function Sparkline({ data, color = '#1F5FBF' }: { data: (number | null)[]; color?: string }) {
  if (!data.some((v) => v !== null)) return null;
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-20 shrink-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
