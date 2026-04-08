import { formatCurrency } from "../lib/currency";
import type { EmployeeEarningsRow } from "../lib/dashboard-reporting";

type TopEarnersCardProps = {
  rows: EmployeeEarningsRow[];
  currency: string;
  title?: string;
};

export function TopEarnersCard({
  rows,
  currency,
  title = "Top earners",
}: TopEarnersCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_24px_60px_rgba(97,73,54,0.10)]">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.employeeId}
            className="flex items-center justify-between rounded-2xl border border-[#e0d2c2] bg-[rgba(255,251,246,0.96)] px-4 py-4"
          >
            <div className="min-w-0">
              <p className="text-sm text-[#8c7a6c]">#{row.rank}</p>
              <p className="truncate text-base font-semibold text-[#43362f]">
                {row.employeeName}
              </p>
            </div>
            <p className="text-base font-semibold text-[#43362f]">
              {formatCurrency(row.netTips, currency)}
            </p>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#7f6c5f]">No employee earnings available.</p>
      ) : null}
    </section>
  );
}
