import { formatCurrency } from "../lib/currency";
import type { EmployeeEarningsRow } from "../lib/dashboard-reporting";

type EmployeeEarningsTableProps = {
  rows: EmployeeEarningsRow[];
  currency: string;
};

export function EmployeeEarningsTable({
  rows,
  currency,
}: EmployeeEarningsTableProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_24px_60px_rgba(97,73,54,0.10)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">
            Employee earnings
          </p>
          <h2 className="mt-2 text-2xl text-[#43362f]">Payroll-ready breakdown</h2>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-3">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.18em] text-[#8c7a6c]">
              <th className="pb-1 pr-4">Rank</th>
              <th className="pb-1 pr-4">Employee</th>
              <th className="pb-1 pr-4">Gross tips</th>
              <th className="pb-1 pr-4">Net tips</th>
              <th className="pb-1 pr-4">Tip count</th>
              <th className="pb-1">Average tip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.employeeId} className="rounded-2xl bg-[rgba(255,251,246,0.96)] text-sm text-[#43362f]">
                <td className="rounded-l-2xl px-4 py-4 font-semibold">{row.rank}</td>
                <td className="px-4 py-4 font-medium">{row.employeeName}</td>
                <td className="px-4 py-4">{formatCurrency(row.grossTips, currency)}</td>
                <td className="px-4 py-4">{formatCurrency(row.netTips, currency)}</td>
                <td className="px-4 py-4">{row.tipCount}</td>
                <td className="rounded-r-2xl px-4 py-4">
                  {formatCurrency(row.averageTip, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#7f6c5f]">No earnings found for this selection.</p>
      ) : null}
    </section>
  );
}
