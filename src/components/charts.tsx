"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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
  const hasSinglePoint = data.length === 1;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 6" vertical={true} stroke="#d9c8b8" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#8c7a6c", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#8c7a6c", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#fffaf5",
              border: "1px solid #d7c5b2",
              borderRadius: "16px",
              color: "#43362f",
            }}
            labelStyle={{ color: "#8f7862" }}
            formatter={(value: number) => [`£${value.toFixed(2)}`, "Gross tips"]}
          />
          {hasSinglePoint ? (
            <ReferenceLine
              y={data[0]?.grossTips ?? 0}
              stroke="#5f4a3b"
              strokeWidth={3}
              strokeDasharray="0"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="grossTips"
            stroke="#5f4a3b"
            strokeWidth={3}
            dot={
              hasSinglePoint
                ? { r: 6, fill: "#5f4a3b", stroke: "#fffaf5", strokeWidth: 2 }
                : { r: 0 }
            }
            activeDot={{ r: 6, fill: "#5f4a3b", stroke: "#fffaf5", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PoolChart({ data }: PoolChartProps) {
  const colors = ["#8f7862", "#b49e89", "#d3c2b0", "#eadfd3"];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12 }}>
          <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#e2d5c7" />
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
