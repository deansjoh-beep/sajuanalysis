import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ChartItem {
  name: string;
  value: number;
  color: string;
}

interface FiveElementsPieChartProps {
  data: ChartItem[];
}

const FiveElementsPieChart: React.FC<FiveElementsPieChartProps> = ({ data }) => {
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <ResponsiveContainer width="100%" height={130}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[12px] text-ink-700">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FiveElementsPieChart;
