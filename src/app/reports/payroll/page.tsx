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

  redirect(`/customer-admin/reports/payroll${params.toString() ? `?${params.toString()}` : ""}`);
}
