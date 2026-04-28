import { CustomerPoolDistributionManager } from "../../../../components/customer-admin/customer-pool-distribution-manager";
import { requireCustomerUser } from "../../../../lib/admin-session";
import { prisma } from "../../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerPoolDistributionPage() {
  const user = await requireCustomerUser();

  const [venues, pools, payrollPeriods] = await Promise.all([
    prisma.venue.findMany({
      where: { customerId: user.customerId!, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pool.findMany({
      where: { customerId: user.customerId!, status: "ACTIVE" },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        poolType: true,
        venueId: true,
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
  const defaultPoolId =
    pools.find((pool) => pool.venueId === defaultVenueId)?.id ?? pools[0]?.id ?? "";
  const defaultPayrollPeriodId = payrollPeriods[0]?.id ?? "";

  return (
    <CustomerPoolDistributionManager
      venues={venues}
      pools={pools}
      payrollPeriods={payrollPeriods}
      defaultSelectedVenueId={defaultVenueId}
      defaultSelectedPoolId={defaultPoolId}
      defaultSelectedPayrollPeriodId={defaultPayrollPeriodId}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
      canUnlock={user.role === "CUSTOMER_ADMIN"}
    />
  );
}
