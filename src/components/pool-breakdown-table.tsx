import { formatCurrency } from "../lib/currency";
import type { PoolSummaryRow } from "../lib/dashboard-reporting";

type PoolBreakdownTableProps = {
  rows: PoolSummaryRow[];
  currency: string;
};

export function PoolBreakdownTable({ rows, currency }: PoolBreakdownTableProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#151515] bg-[#090909] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Tips by pool</p>
      <h2 className="mt-2 text-2xl text-white">Pool performance</h2>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={row.poolId}
            className="rounded-2xl border border-[#171717] bg-[#0b0b0b] px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-white">{row.poolName}</p>
                <p className="mt-1 text-sm text-[#9b9b9b]">
                  {row.memberCount} active members
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#9b9b9b]">
                  {formatCurrency(row.grossTips, currency)}
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {formatCurrency(row.netTips, currency)} net
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#9b9b9b]">No pool allocations found.</p>
      ) : null}
    </section>
  );
}
