import Link from "next/link";

import { TrendChart } from "../../components/charts";
import { requireCustomerUser } from "../../lib/admin-session";
import { formatCurrency } from "../../lib/currency";
import { getDashboardOverview } from "../../lib/dashboard-reporting";

export const dynamic = "force-dynamic";

type CustomerAdminPageProps = {
  searchParams: Promise<{
    venueId?: string;
  }>;
};

export default async function CustomerAdminPage({
  searchParams,
}: CustomerAdminPageProps) {
  const user = await requireCustomerUser();
  const { venueId } = await searchParams;
  const data = await getDashboardOverview(user.customerId!, venueId ?? null);

  const selectedVenueName =
    venueId
      ? data.context.venues.find((venue) => venue.id === venueId)?.name ?? data.context.customerName
      : "All venues";
  const currentTrend = data.monthlyTrend[data.monthlyTrend.length - 1] ?? null;
  const performanceSegments = data.monthlyTrend.slice(-3);
  const performanceTotal = performanceSegments.reduce((sum, item) => sum + item.grossTips, 0);
  const averageRating = data.averageRating > 0 ? data.averageRating.toFixed(1) : "5.0";
  const segmentAngles = performanceSegments.reduce<number[]>((angles, item, index) => {
    const previous = angles[index - 1] ?? 0;
    const share = performanceTotal > 0 ? (item.grossTips / performanceTotal) * 360 : 120;
    angles.push(previous + share);
    return angles;
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <section className="rounded-[2rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-6 shadow-[0_30px_90px_rgba(97,73,54,0.10)]">
          <p className="text-2xl font-semibold text-[#41342d] sm:text-4xl">{selectedVenueName}</p>
          <p className="mt-6 text-6xl font-semibold leading-none text-[#9e866f] sm:text-7xl">
            {formatCurrency(currentTrend?.grossTips ?? data.totalGrossTips, data.context.currency)}
          </p>
          <p className="mt-3 text-2xl text-[#6f5f54]">Total tips this month</p>

          <div className="mt-8 rounded-[1.8rem] border border-[#dfd0c1] bg-[#f8f1ea] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-medium text-[#41342d]">Monthly Performance</p>
                <p className="mt-1 text-sm text-[#8c796b]">Latest three periods</p>
              </div>
              <Link
                href="/customer-admin/reports/payroll"
                className="rounded-xl border border-[#cbb8a3] bg-[#a7907b] px-3 py-2 text-sm font-medium text-[#fffaf4] no-underline transition hover:opacity-90"
              >
                Export
              </Link>
            </div>

            <div className="mt-8 flex justify-center">
              <div
                className="relative h-56 w-56 rounded-full"
                style={{
                  background: `conic-gradient(#8d7762 0deg ${segmentAngles[0] ?? 120}deg, #b8a38d ${segmentAngles[0] ?? 120}deg ${segmentAngles[1] ?? 240}deg, #dac9b7 ${segmentAngles[1] ?? 240}deg 360deg)`,
                }}
              >
                <div className="absolute inset-[14px] rounded-full border border-[#eaded2] bg-[#f6efe8]" />
                <div className="absolute inset-[34px] rounded-full border-[6px] border-[#b19b85]" />
                <div className="absolute inset-[50px] rounded-full border-[6px] border-[#ded0c3]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-semibold text-[#43362f]">
                      {formatCurrency(currentTrend?.grossTips ?? data.totalGrossTips, data.context.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {performanceSegments.map((item, index) => {
                const swatch = ["#8d7762", "#b8a38d", "#dac9b7"][index] ?? "#b8a38d";
                const share =
                  performanceTotal > 0 ? Math.round((item.grossTips / performanceTotal) * 100) : 0;

                return (
                  <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: swatch }}
                      />
                      <span className="text-[#6f6054]">{item.label}</span>
                    </div>
                    <span className="font-medium text-[#43362f]">{share}%</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 border-t border-[#e5d8cb] pt-4 text-center">
              <Link
                href="/customer-admin/reports/leaderboard"
                className="text-sm font-medium text-[#665649] no-underline transition hover:text-[#9e866f]"
              >
                View all
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex flex-wrap gap-3">
              <Link
                href="/customer-admin"
                className={`rounded-full border px-4 py-2 text-sm font-semibold no-underline transition ${
                  !venueId
                    ? "border-[#b49e89] bg-[#b49e89] text-[#fffaf4]"
                    : "border-[#d8c7b5] bg-[rgba(255,250,244,0.82)] text-[#5b4b40] hover:border-[#b49e89]"
                }`}
              >
                All venues
              </Link>
              {data.context.venues.map((venue) => {
                const active = venue.id === venueId;

                return (
                  <Link
                    key={venue.id}
                    href={`/customer-admin?venueId=${venue.id}`}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold no-underline transition ${
                      active
                        ? "border-[#b49e89] bg-[#b49e89] text-[#fffaf4]"
                        : "border-[#d8c7b5] bg-[rgba(255,250,244,0.82)] text-[#5b4b40] hover:border-[#b49e89]"
                    }`}
                  >
                    {venue.name}
                  </Link>
                );
              })}
            </div>

            <div className="justify-self-start rounded-xl border border-[#d8c7b5] bg-[rgba(255,250,244,0.82)] px-4 py-2 text-sm text-[#5b4b40] md:justify-self-end">
              {currentTrend?.label ?? "Latest period"}
            </div>
          </div>

          <div className="grid gap-6 rounded-[2rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-6 shadow-[0_30px_90px_rgba(97,73,54,0.10)] xl:grid-cols-[0.95fr_1.4fr]">
            <div className="space-y-4">
              <p className="text-3xl font-semibold text-[#43362f] sm:text-4xl">
                {averageRating}
                <span className="ml-2 text-[#b49e89]">★</span>
              </p>
              <p className="text-2xl font-medium text-[#43362f]">Monthly tips &amp; rating</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-[#e4d7ca] bg-[#f8f1ea] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8c7a6c]">Net distributable</p>
                  <p className="mt-3 text-3xl font-semibold text-[#43362f]">
                    {formatCurrency(data.totalNetTips, data.context.currency)}
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#e4d7ca] bg-[#f8f1ea] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8c7a6c]">Active employees</p>
                  <p className="mt-3 text-3xl font-semibold text-[#43362f]">{data.activeEmployees}</p>
                </div>
              </div>
            </div>

            <div>
              <TrendChart data={data.monthlyTrend} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-6 shadow-[0_30px_90px_rgba(97,73,54,0.10)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-3xl font-semibold text-[#43362f]">Top staff performance</h2>
              <Link
                href="/customer-admin/reports/leaderboard"
                className="text-sm font-medium text-[#665649] no-underline transition hover:text-[#9e866f]"
              >
                View leaderboard
              </Link>
            </div>

            <div className="mt-6">
              {data.topEarners.map((row) => (
                <div
                  key={row.employeeId}
                  className="flex items-center justify-between gap-4 border-t border-[#e4d7ca] py-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#b49e89] text-sm font-semibold text-[#8f7862]">
                      {row.rank}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-medium text-[#43362f]">{row.employeeName}</p>
                      <p className="text-sm text-[#8c7a6c]">{row.tipCount} tips attributed</p>
                    </div>
                  </div>
                  <p className="text-2xl font-semibold text-[#43362f]">
                    {formatCurrency(row.netTips, data.context.currency)}
                  </p>
                </div>
              ))}

              {data.topEarners.length === 0 ? (
                <p className="text-sm text-[#9a9a9a]">No tip performance data is available yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
