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
  const report = await getPayrollReport(user.customerId!, {
    venueId: venueId ?? null,
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
          title="Net distributable"
          value={formatCurrency(report.summary.netTips, report.context.currency)}
          helper="Employee allocation total"
        />
        <DashboardCard
          title="Employees in report"
          value={String(report.summary.employeeCount)}
          helper={`${report.summary.tipCount} tips included`}
        />
      </section>

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
