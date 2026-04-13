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
    <ResponsiveContainer width="100%" height={150}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
          {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default FiveElementsPieChart;
