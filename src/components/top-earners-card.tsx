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
    <section className="rounded-[1.75rem] border border-[#151515] bg-[#090909] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.employeeId}
            className="flex items-center justify-between rounded-2xl border border-[#171717] bg-[#0b0b0b] px-4 py-4"
          >
            <div className="min-w-0">
              <p className="text-sm text-[#8d8d8d]">#{row.rank}</p>
              <p className="truncate text-base font-semibold text-white">
                {row.employeeName}
              </p>
            </div>
            <p className="text-base font-semibold text-white">
              {formatCurrency(row.netTips, currency)}
            </p>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#9b9b9b]">No employee earnings available.</p>
      ) : null}
    </section>
  );
}
