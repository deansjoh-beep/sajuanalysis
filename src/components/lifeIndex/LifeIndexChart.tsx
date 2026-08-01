import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import {
  LIFE_INDEX_TAG_LABELS, toHangulGanzhi,
  type LifeIndexKey, type LifeIndexPoint,
} from '../../lib/analysis/lifeIndex';

interface LifeIndexChartProps {
  points: LifeIndexPoint[];
  activeKey: LifeIndexKey;
  currentAge: number | null;
  color: string;
}

/** 대운 경계(간지가 바뀌는 나이)를 찾아 세로 구분선을 그린다. */
function daeunBoundaries(points: LifeIndexPoint[]): Array<{ age: number; label: string }> {
  const out: Array<{ age: number; label: string }> = [];
  let prev: string | null = null;
  for (const p of points) {
    if (p.daeunGanzhi && p.daeunGanzhi !== prev) {
      out.push({ age: p.age, label: toHangulGanzhi(p.daeunGanzhi) });
      prev = p.daeunGanzhi;
    }
  }
  return out;
}

function ChartTooltip({ active, payload, activeKey }: any) {
  if (!active || !payload?.length) return null;
  const point: LifeIndexPoint = payload[0].payload;
  const tags = point.tags[activeKey] ?? [];
  return (
    <div className="rounded-xl border border-ink-300/40 bg-white px-3 py-2 shadow-md max-w-[220px]">
      <p className="text-[12px] text-ink-900 font-bold">
        {point.age}세 · {point.year}년 · {toHangulGanzhi(point.seunGanzhi)}년
      </p>
      <p className="text-[12px] text-ink-500 mt-0.5">지수 {point[activeKey]}</p>
      {tags.length > 0 && (
        <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">
          {tags.map((t) => LIFE_INDEX_TAG_LABELS[t] ?? t).join(' · ')}
        </p>
      )}
    </div>
  );
}

export default function LifeIndexChart({ points, activeKey, currentAge, color }: LifeIndexChartProps) {
  const boundaries = daeunBoundaries(points);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="age"
          type="number"
          domain={[0, 99]}
          ticks={[0, 20, 40, 60, 80, 99]}
          tickFormatter={(v) => `${v}세`}
          tick={{ fontSize: 11, fill: '#9c8e7e' }}
          axisLine={{ stroke: '#d8d0c0' }}
          tickLine={false}
        />
        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
        <Tooltip content={<ChartTooltip activeKey={activeKey} />} />
        {boundaries.map((b) => (
          <ReferenceLine
            key={b.age}
            x={b.age}
            stroke="#d8d0c0"
            strokeDasharray="3 3"
            label={{ value: b.label, position: 'top', fontSize: 11, fill: '#a39a89' }}
          />
        ))}
        {currentAge != null && currentAge >= 0 && currentAge <= 99 && (
          <ReferenceLine
            x={currentAge}
            stroke="#c2410c"
            strokeWidth={1.5}
            label={{ value: '현재', position: 'insideTopRight', fontSize: 11, fill: '#c2410c' }}
          />
        )}
        <Line type="monotone" dataKey={activeKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
