import Link from "next/link";

import { TrendChart } from "../../components/charts";
import { requireCustomerUser } from "../../lib/admin-session";
import { formatCurrency } from "../../lib/currency";
import { getDashboardOverview } from "../../lib/dashboard-reporting";

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
    data.context.venues.find((venue) => venue.id === venueId)?.name ??
    data.context.venues[0]?.name ??
    data.context.customerName;
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
        <section className="rounded-[2rem] border border-[#635113] bg-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
          <p className="text-2xl font-semibold text-white sm:text-4xl">{selectedVenueName}</p>
          <p className="mt-6 text-6xl font-semibold leading-none text-[#f5d31d] sm:text-7xl">
            {formatCurrency(currentTrend?.grossTips ?? data.totalGrossTips, data.context.currency)}
          </p>
          <p className="mt-3 text-2xl text-[#f2f2f2]">Total tips this month</p>

          <div className="mt-8 rounded-[1.8rem] border border-[#6a5613] bg-[#070707] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-medium text-white">Monthly Performance</p>
                <p className="mt-1 text-sm text-[#8f8f8f]">Latest three periods</p>
              </div>
              <Link
                href="/customer-admin/reports/payroll"
                className="rounded-xl border border-[#27304e] bg-[#10193e] px-3 py-2 text-sm font-medium text-white no-underline transition hover:bg-[#14224f]"
              >
                Export
              </Link>
            </div>

            <div className="mt-8 flex justify-center">
              <div
                className="relative h-56 w-56 rounded-full"
                style={{
                  background: `conic-gradient(#b79a0f 0deg ${segmentAngles[0] ?? 120}deg, #f5d31d ${segmentAngles[0] ?? 120}deg ${segmentAngles[1] ?? 240}deg, #233164 ${segmentAngles[1] ?? 240}deg 360deg)`,
                }}
              >
                <div className="absolute inset-[14px] rounded-full border border-[#1a1a1a] bg-[#050505]" />
                <div className="absolute inset-[34px] rounded-full border-[6px] border-[#f5d31d]" />
                <div className="absolute inset-[50px] rounded-full border-[6px] border-[#24336a]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-4xl font-semibold text-white">
                      {formatCurrency(currentTrend?.grossTips ?? data.totalGrossTips, data.context.currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {performanceSegments.map((item, index) => {
                const swatch = ["#b79a0f", "#f5d31d", "#233164"][index] ?? "#f5d31d";
                const share =
                  performanceTotal > 0 ? Math.round((item.grossTips / performanceTotal) * 100) : 0;

                return (
                  <div key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: swatch }}
                      />
                      <span className="text-[#d9d9d9]">{item.label}</span>
                    </div>
                    <span className="font-medium text-white">{share}%</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 border-t border-[#151515] pt-4 text-center">
              <Link
                href="/customer-admin/reports/leaderboard"
                className="text-sm font-medium text-white no-underline transition hover:text-[#f5d31d]"
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
                    ? "border-[#f5d31d] bg-[#f5d31d] text-[#060606]"
                    : "border-[#303030] bg-[#0b0b0b] text-white hover:border-[#5f4d10]"
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
                        ? "border-[#f5d31d] bg-[#f5d31d] text-[#060606]"
                        : "border-[#303030] bg-[#0b0b0b] text-white hover:border-[#5f4d10]"
                    }`}
                  >
                    {venue.name}
                  </Link>
                );
              })}
            </div>

            <div className="justify-self-start rounded-xl border border-[#1f2948] bg-[#0e1635] px-4 py-2 text-sm text-white md:justify-self-end">
              {currentTrend?.label ?? "Latest period"}
            </div>
          </div>

          <div className="grid gap-6 rounded-[2rem] border border-[#151515] bg-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)] xl:grid-cols-[0.95fr_1.4fr]">
            <div className="space-y-4">
              <p className="text-3xl font-semibold text-white sm:text-4xl">
                {averageRating}
                <span className="ml-2 text-[#f5d31d]">★</span>
              </p>
              <p className="text-2xl font-medium text-white">Monthly tips &amp; rating</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-[#151515] bg-[#090909] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7f7f7f]">Net distributable</p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {formatCurrency(data.totalNetTips, data.context.currency)}
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#151515] bg-[#090909] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7f7f7f]">Active employees</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{data.activeEmployees}</p>
                </div>
              </div>
            </div>

            <div>
              <TrendChart data={data.monthlyTrend} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#151515] bg-[#050505] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-3xl font-semibold text-white">Top staff performance</h2>
              <Link
                href="/customer-admin/reports/leaderboard"
                className="text-sm font-medium text-white no-underline transition hover:text-[#f5d31d]"
              >
                View leaderboard
              </Link>
            </div>

            <div className="mt-6">
              {data.topEarners.map((row) => (
                <div
                  key={row.employeeId}
                  className="flex items-center justify-between gap-4 border-t border-[#5f4d10] py-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#f5d31d] text-sm font-semibold text-[#f5d31d]">
                      {row.rank}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xl font-medium text-white">{row.employeeName}</p>
                      <p className="text-sm text-[#898989]">{row.tipCount} tips attributed</p>
                    </div>
                  </div>
                  <p className="text-2xl font-semibold text-white">
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
