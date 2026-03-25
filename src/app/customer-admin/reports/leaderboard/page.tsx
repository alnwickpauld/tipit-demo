import { FilterBar } from "../../../../components/filter-bar";
import { requireCustomerUser } from "../../../../lib/admin-session";
import { formatCurrency } from "../../../../lib/currency";
import {
  getLeaderboardReport,
  type RankingGranularity,
} from "../../../../lib/dashboard-reporting";

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
  const report = await getLeaderboardReport(user.customerId!, {
    venueId: venueId ?? null,
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
          { value: "monthly", label: "Monthly" },
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
        <section className="rounded-[1.75rem] border border-[#151515] bg-[#090909] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
          <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">Current leaders</p>
          <h2 className="mt-2 text-2xl text-white">{report.latestBucket.label}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-[#171717] bg-[#0b0b0b] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8d8d8d]">
                Period average rating
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {report.latestBucket.averageRating > 0
                  ? `${report.latestBucket.averageRating.toFixed(1)} / 5`
                  : "No ratings"}
              </p>
            </div>
            <div className="rounded-2xl border border-[#171717] bg-[#0b0b0b] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8d8d8d]">Ranking mode</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {report.selectedRankingMode === "rating" ? "Best rating" : "Tips earned"}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {report.latestBucket.rows.slice(0, 3).map((row) => (
              <div key={row.employeeId} className="rounded-2xl border border-[#171717] bg-[#0b0b0b] p-4">
                <p className="text-sm text-[#8d8d8d]">#{row.rank}</p>
                <p className="mt-2 text-xl font-semibold text-white">{row.employeeName}</p>
                <div className="mt-3 space-y-1 text-base text-[#d0d0d0]">
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
            className="rounded-[1.75rem] border border-[#151515] bg-[#090909] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[#8d8d8d]">
                  {report.selectedGranularity}
                </p>
                <h2 className="mt-2 text-2xl text-white">{bucket.label}</h2>
              </div>
              <p className="text-sm text-[#9b9b9b]">{bucket.rows.length} ranked employees</p>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-[#8d8d8d]">
                    <th className="pb-1 pr-4">Rank</th>
                    <th className="pb-1 pr-4">Employee</th>
                    <th className="pb-1 pr-4">Average rating</th>
                    <th className="pb-1">Net earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.rows.map((row) => (
                    <tr key={row.employeeId} className="bg-[#0b0b0b] text-sm text-white">
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
