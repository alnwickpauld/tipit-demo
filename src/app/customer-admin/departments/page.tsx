import { CustomerDepartmentsManager } from "../../../components/customer-admin/customer-departments-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerDepartmentsPage() {
  const user = await requireCustomerUser();
  const [departments, venues] = await Promise.all([
    prisma.department.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        venueId: true,
        name: true,
        slug: true,
        type: true,
        description: true,
        isActive: true,
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            serviceAreas: true,
          },
        },
      },
    }),
    prisma.venue.findMany({
      where: { customerId: user.customerId! },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <CustomerDepartmentsManager
      departments={departments}
      venues={venues}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
    />
  );
}
