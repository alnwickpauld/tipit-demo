import { formatCurrency } from "../lib/currency";
import type { PoolSummaryRow } from "../lib/dashboard-reporting";

type PoolBreakdownTableProps = {
  rows: PoolSummaryRow[];
  currency: string;
};

export function PoolBreakdownTable({ rows, currency }: PoolBreakdownTableProps) {
  return (
    <section className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_24px_60px_rgba(97,73,54,0.10)]">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">Tips by pool</p>
      <h2 className="mt-2 text-2xl text-[#43362f]">Pool performance</h2>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={row.poolId}
            className="rounded-2xl border border-[#e0d2c2] bg-[rgba(255,251,246,0.96)] px-4 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-[#43362f]">{row.poolName}</p>
                <p className="mt-1 text-sm text-[#7f6c5f]">
                  {row.memberCount} active members
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#7f6c5f]">
                  {formatCurrency(row.grossTips, currency)}
                </p>
                <p className="mt-1 text-lg font-semibold text-[#43362f]">
                  {formatCurrency(row.netTips, currency)} net
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-[#7f6c5f]">No pool allocations found.</p>
      ) : null}
    </section>
  );
}
