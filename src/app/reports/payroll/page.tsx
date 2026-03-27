import type { Route } from "next";
import { redirect } from "next/navigation";

type PayrollReportPageProps = {
  searchParams: Promise<{
    venueId?: string;
    payrollPeriodId?: string;
  }>;
};

export default async function PayrollReportPage({
  searchParams,
}: PayrollReportPageProps) {
  const { venueId, payrollPeriodId } = await searchParams;
  const params = new URLSearchParams();

  if (venueId) {
    params.set("venueId", venueId);
  }

  if (payrollPeriodId) {
    params.set("payrollPeriodId", payrollPeriodId);
  }

  const target = `/customer-admin/reports/payroll${params.toString() ? `?${params.toString()}` : ""}`;
  redirect(target as Route);
}
