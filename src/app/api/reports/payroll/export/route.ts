import { NextRequest, NextResponse } from "next/server";

import { getPayrollExportRows, getPayrollReport } from "../../../../../lib/dashboard-reporting";
import { AuthService } from "../../../../../server/domains/auth/auth.service";
import { getSessionTokenFromRequest } from "../../../../../server/shared/auth/session";

export async function GET(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let user;
  try {
    user = await new AuthService().getCurrentUser(token);
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!user.customerId) {
    return NextResponse.json({ error: "Customer scope is required." }, { status: 403 });
  }

  const venueId = request.nextUrl.searchParams.get("venueId");
  const payrollPeriodId = request.nextUrl.searchParams.get("payrollPeriodId");

  const [report, exportRows] = await Promise.all([
    getPayrollReport(user.customerId, {
      venueId,
      payrollPeriodId,
    }),
    getPayrollExportRows(user.customerId, {
      venueId,
      payrollPeriodId,
    }),
  ]);

  const header = [
    "employeeId",
    "payrollReference",
    "employeeName",
    "grossTips",
    "netTips",
    "poolAllocation",
    "totalPayrollAmount",
    "tipCount",
    "averageTip",
    "hoursSource",
    "rank",
  ];

  const rows = exportRows.map((row) =>
    [
      row.employeeId,
      escapeCsv(row.payrollReference ?? ""),
      escapeCsv(row.employeeName),
      row.grossTips.toFixed(2),
      row.netTips.toFixed(2),
      row.poolAllocation.toFixed(2),
      row.totalPayrollAmount.toFixed(2),
      String(row.tipCount),
      row.averageTip.toFixed(2),
      escapeCsv(row.hoursSource),
      String(row.rank),
    ].join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tipit-payroll-${slugify(report.selectedPeriodLabel)}.csv"`,
    },
  });
}

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
