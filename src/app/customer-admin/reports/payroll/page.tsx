import type { Route } from "next";
import Link from "next/link";

import { DashboardCard } from "../../../../components/dashboard-card";
import { EmployeeEarningsTable } from "../../../../components/employee-earnings-table";
import { FilterBar } from "../../../../components/filter-bar";
import { PoolBreakdownTable } from "../../../../components/pool-breakdown-table";
import { TopEarnersCard } from "../../../../components/top-earners-card";
import { requireCustomerUser } from "../../../../lib/admin-session";
import { formatCurrency } from "../../../../lib/currency";
import { getPayrollReport } from "../../../../lib/dashboard-reporting";

export const dynamic = "force-dynamic";

type PayrollReportPageProps = {
  searchParams: Promise<{
    venueId?: string;
    payrollPeriodId?: string;
  }>;
};

export default async function CustomerPayrollReportPage({
  searchParams,
}: PayrollReportPageProps) {
  const user = await requireCustomerUser();
  const { venueId, payrollPeriodId } = await searchParams;
  const baseReport = await getPayrollReport(user.customerId!, {
    venueId: null,
    payrollPeriodId: payrollPeriodId ?? null,
  });
  const defaultVenueId =
    baseReport.context.venues.find((venue) => venue.name === "Sandman Signature Newcastle")?.id ??
    baseReport.context.venues[0]?.id ??
    null;
  const activeVenueId = venueId ?? defaultVenueId;
  const report = await getPayrollReport(user.customerId!, {
    venueId: activeVenueId,
    payrollPeriodId: payrollPeriodId ?? null,
  });

  const exportParams = new URLSearchParams();
  if (report.selectedVenueId) {
    exportParams.set("venueId", report.selectedVenueId);
  }
  if (report.selectedPayrollPeriodId) {
    exportParams.set("payrollPeriodId", report.selectedPayrollPeriodId);
  }

  return (
    <div className="space-y-6">
      <FilterBar
        basePath="/customer-admin/reports/payroll"
        venueOptions={report.context.venues.map((venue) => ({
          value: venue.id,
          label: venue.name,
        }))}
        payrollPeriodOptions={report.context.payrollPeriods.map((period) => ({
          value: period.id,
          label: period.label,
        }))}
        selectedVenueId={report.selectedVenueId}
        selectedPayrollPeriodId={report.selectedPayrollPeriodId}
        extraAction={
          <Link
            href={`/api/reports/payroll/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}` as Route}
            className="inline-flex rounded-full border border-[#b49e89] bg-[#b49e89] px-5 py-3 text-sm font-semibold text-[#fffaf4] no-underline transition hover:opacity-90"
          >
            Export CSV
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Payroll period"
          value={report.selectedPeriodLabel}
          helper="Current reporting window"
        />
        <DashboardCard
          title="Gross tips"
          value={formatCurrency(report.summary.grossTips, report.context.currency)}
          helper="Before Tipit fees"
        />
        <DashboardCard
          title="Net tips"
          value={formatCurrency(report.summary.netTips, report.context.currency)}
          helper="Allocated from guest tips"
        />
        <DashboardCard
          title="Pool allocations"
          value={formatCurrency(report.summary.poolAllocations, report.context.currency)}
          helper="Locked hourly pool distributions"
        />
        <DashboardCard
          title="Payroll total"
          value={formatCurrency(report.summary.payrollTotal, report.context.currency)}
          helper={`${report.summary.tipCount} tips included`}
        />
      </section>

      {report.tipOutSummary.postingCount > 0 ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              title="Tip-out transferred"
              value={formatCurrency(report.tipOutSummary.totalTransferred, report.context.currency)}
              helper={`${report.tipOutSummary.postingCount} deduction postings`}
            />
            <DashboardCard
              title="Pools funded"
              value={String(report.tipOutPools.length)}
              helper="Target pools receiving tip-out transfers"
            />
            <DashboardCard
              title="Staff with tip-out"
              value={String(report.tipOutSummary.affectedStaffCount)}
              helper="Servers with posted deductions this period"
            />
          </section>

          <section className="rounded-[1.8rem] border border-[#d9c8b8] bg-[rgba(255,251,246,0.84)] p-6 shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">Tip-Out Pools</p>
                <h2 className="mt-2 text-2xl text-[#43362f]">Hourly payroll distribution preview</h2>
                <p className="mt-2 text-sm text-[#8a7667]">
                  Posted server tip-outs flowing into payroll-period pools and the implied per-hour rates.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3 text-sm text-[#4f433b]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.24em] text-[#8d8d8d]">
                    <th className="px-4 py-2">Pool</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Transferred</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2">Per hour</th>
                  </tr>
                </thead>
                <tbody>
                  {report.tipOutPools.map((pool) => (
                    <tr
                      key={pool.poolId}
                      className="rounded-[1.2rem] border border-[#dcc8b2] bg-[rgba(255,251,246,0.92)] shadow-[0_12px_30px_rgba(96,71,49,0.06)]"
                    >
                      <td className="rounded-l-[1.2rem] px-4 py-4 font-semibold text-[#43362f]">{pool.poolName}</td>
                      <td className="px-4 py-4">{pool.poolType}</td>
                      <td className="px-4 py-4">{formatCurrency(pool.totalTransferred, report.context.currency)}</td>
                      <td className="px-4 py-4">{pool.totalHoursWorked.toFixed(2)}</td>
                      <td className="rounded-r-[1.2rem] px-4 py-4">
                        {formatCurrency(pool.perHourRate, report.context.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <EmployeeEarningsTable rows={report.rows} currency={report.context.currency} />
        <TopEarnersCard
          rows={report.topEarners}
          currency={report.context.currency}
          title="Top earners this period"
        />
      </section>

      <PoolBreakdownTable rows={report.poolBreakdown} currency={report.context.currency} />
    </div>
  );
}
