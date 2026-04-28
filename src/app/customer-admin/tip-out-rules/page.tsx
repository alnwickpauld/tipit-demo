import { CustomerTipOutRulesManager } from "../../../components/customer-admin/customer-tip-out-rules-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerTipOutRulesPage() {
  const user = await requireCustomerUser();
  const [rules, venues, departments, pools, staffMembers, payrollPeriods] = await Promise.all([
    prisma.tipOutRule.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ scope: "desc" }, { venue: { name: "asc" } }, { department: { name: "asc" } }, { name: "asc" }],
      include: {
        venue: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, revenueCentreType: true } },
        targetPool: { select: { id: true, name: true, poolType: true } },
      },
    }),
    prisma.venue.findMany({
      where: { customerId: user.customerId! },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        venueId: true,
        name: true,
        revenueCentreType: true,
        isActive: true,
      },
    }),
    prisma.pool.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        venueId: true,
        name: true,
        poolType: true,
        status: true,
      },
    }),
    prisma.staffMember.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ venue: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        venueId: true,
        displayName: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    }),
    prisma.payrollPeriod.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ startDate: "desc" }],
      take: 12,
      select: {
        id: true,
        label: true,
        startDate: true,
        endDate: true,
      },
    }),
  ]);

  const defaultVenueId =
    venues.find((venue) => venue.name === "Sandman Signature Newcastle")?.id ?? venues[0]?.id ?? "";

  const ruleSummaries = rules.map((rule) => {
    const rateDecimal = Number(rule.rateDecimal);
    const ratePercentage = Number((rateDecimal * 100).toFixed(3));

    return {
      id: rule.id,
      scope: rule.scope,
      venueId: rule.venueId,
      departmentId: rule.departmentId,
      targetPoolId: rule.targetPoolId,
      name: rule.name,
      description: rule.description,
      rateDecimal,
      ratePercentage,
      ratePercentageLabel: `${ratePercentage}%`,
      capAtAvailableTipBalance: rule.capAtAvailableTipBalance,
      isActive: rule.isActive,
      venue: rule.venue ?? undefined,
      department: rule.department ?? undefined,
      targetPool: rule.targetPool,
    };
  });

  return (
    <CustomerTipOutRulesManager
      rules={ruleSummaries}
      venues={venues}
      departments={departments}
      pools={pools}
      staffMembers={staffMembers}
      payrollPeriods={payrollPeriods}
      defaultSelectedVenueId={defaultVenueId}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
    />
  );
}
