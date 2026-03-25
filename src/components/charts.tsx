"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
} from "recharts";

type TrendChartProps = {
  data: { label: string; grossTips: number }[];
};

type PoolChartProps = {
  data: { name: string; netTips: number }[];
};

export function TrendChart({ data }: TrendChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 6" vertical={true} stroke="#162243" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#d8d8d8", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#d8d8d8", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0a0a0a",
              border: "1px solid #283567",
              borderRadius: "16px",
              color: "#ffffff",
            }}
            labelStyle={{ color: "#f5d31d" }}
            formatter={(value: number) => [`£${value.toFixed(2)}`, "Gross tips"]}
          />
          <Line
            type="monotone"
            dataKey="grossTips"
            stroke="#f5d31d"
            strokeWidth={3}
            dot={{ r: 0 }}
            activeDot={{ r: 5, fill: "#f5d31d", stroke: "#050505", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PoolChart({ data }: PoolChartProps) {
  const colors = ["#223252", "#50627f", "#7b8ba6", "#9dadc7"];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#e6ebf5" />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip />
          <Bar dataKey="netTips" radius={[0, 10, 10, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
