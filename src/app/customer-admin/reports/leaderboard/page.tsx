import { FilterBar } from "../../../../components/filter-bar";
import { requireCustomerUser } from "../../../../lib/admin-session";
import { formatCurrency } from "../../../../lib/currency";
import {
  getLeaderboardReport,
  type RankingGranularity,
} from "../../../../lib/dashboard-reporting";

export const dynamic = "force-dynamic";

type LeaderboardPageProps = {
  searchParams: Promise<{
    venueId?: string;
    granularity?: RankingGranularity;
    rankingMode?: "earnings" | "rating";
  }>;
};

export default async function CustomerLeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const user = await requireCustomerUser();
  const { venueId, granularity, rankingMode } = await searchParams;
  const baseReport = await getLeaderboardReport(user.customerId!, {
    venueId: null,
    granularity: granularity ?? "monthly",
    rankingMode: rankingMode ?? "earnings",
  });
  const defaultVenueId =
    baseReport.context.venues.find((venue) => venue.name === "Sandman Signature Newcastle")?.id ??
    baseReport.context.venues[0]?.id ??
    null;
  const activeVenueId = venueId ?? defaultVenueId;
  const report = await getLeaderboardReport(user.customerId!, {
    venueId: activeVenueId,
    granularity: granularity ?? "monthly",
    rankingMode: rankingMode ?? "earnings",
  });

  return (
    <div className="space-y-6">
      <FilterBar
        basePath="/customer-admin/reports/leaderboard"
        venueOptions={report.context.venues.map((venue) => ({
          value: venue.id,
          label: venue.name,
        }))}
        granularityOptions={[
          { value: "monthly", label: "Payroll periods" },
          { value: "quarterly", label: "Quarterly" },
          { value: "yearly", label: "Yearly" },
        ]}
        rankingModeOptions={[
          { value: "earnings", label: "Tips earned" },
          { value: "rating", label: "Best rating" },
        ]}
        selectedVenueId={report.selectedVenueId}
        selectedGranularity={report.selectedGranularity}
        selectedRankingMode={report.selectedRankingMode}
      />

      {report.latestBucket ? (
        <section className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_24px_60px_rgba(97,73,54,0.10)]">
          <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">Current leaders</p>
          <h2 className="mt-2 text-2xl text-[#43362f]">{report.latestBucket.label}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-[#e0d2c2] bg-[rgba(255,251,246,0.96)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c7a6c]">
                Period average rating
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#43362f]">
                {report.latestBucket.averageRating > 0
                  ? `${report.latestBucket.averageRating.toFixed(1)} / 5`
                  : "No ratings"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#e0d2c2] bg-[rgba(255,251,246,0.96)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c7a6c]">Ranking mode</p>
              <p className="mt-2 text-2xl font-semibold text-[#43362f]">
                {report.selectedRankingMode === "rating" ? "Best rating" : "Tips earned"}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {report.latestBucket.rows.slice(0, 3).map((row) => (
              <div key={row.employeeId} className="rounded-2xl border border-[#e0d2c2] bg-[rgba(255,251,246,0.96)] p-4">
                <p className="text-sm text-[#8c7a6c]">#{row.rank}</p>
                <p className="mt-2 text-xl font-semibold text-[#43362f]">{row.employeeName}</p>
                <div className="mt-3 space-y-1 text-base text-[#5f5045]">
                  <p>{formatCurrency(row.total, report.context.currency)}</p>
                  <p>
                    {row.ratingCount > 0
                      ? `${row.averageRating.toFixed(1)} / 5 average rating`
                      : "No ratings yet"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        {report.buckets.map((bucket) => (
          <section
            key={bucket.key}
            className="rounded-[1.75rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_24px_60px_rgba(97,73,54,0.10)]"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#8c7a6c]">
                  {report.selectedGranularityLabel}
                </p>
                <h2 className="mt-2 text-2xl text-[#43362f]">{bucket.label}</h2>
              </div>
              <p className="text-sm text-[#7f6c5f]">{bucket.rows.length} ranked employees</p>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-[#8c7a6c]">
                    <th className="pb-1 pr-4">Rank</th>
                    <th className="pb-1 pr-4">Employee</th>
                    <th className="pb-1 pr-4">Average rating</th>
                    <th className="pb-1">Net earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.rows.map((row) => (
                    <tr key={row.employeeId} className="bg-[rgba(255,251,246,0.96)] text-sm text-[#43362f]">
                      <td className="rounded-l-2xl px-4 py-4 font-semibold">{row.rank}</td>
                      <td className="px-4 py-4 font-medium">{row.employeeName}</td>
                      <td className="px-4 py-4">
                        {row.ratingCount > 0
                          ? `${row.averageRating.toFixed(1)} / 5`
                          : "No ratings"}
                      </td>
                      <td className="rounded-r-2xl px-4 py-4">
                        {formatCurrency(row.total, report.context.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
