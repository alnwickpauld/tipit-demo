import { CustomerServiceAreasManager } from "../../../components/customer-admin/customer-service-areas-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";
import { getServiceAreaTipUrl } from "../../../lib/public-tip-links";

export const dynamic = "force-dynamic";

export default async function CustomerServiceAreasPage() {
  const user = await requireCustomerUser();
  const [serviceAreas, venues, departments] = await Promise.all([
    prisma.serviceArea.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ venue: { name: "asc" } }, { department: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        venueId: true,
        departmentId: true,
        name: true,
        slug: true,
        description: true,
        tipScreenBackgroundColor: true,
        tipScreenTextColor: true,
        tipScreenButtonColor: true,
        tipScreenButtonTextColor: true,
        tipScreenLogoImageUrl: true,
        tippingMode: true,
        displayMode: true,
        isActive: true,
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
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
  ]);
  const defaultVenueId =
    venues.find((venue) => venue.name === "Sandman Signature Newcastle")?.id ?? venues[0]?.id ?? "";

  return (
    <CustomerServiceAreasManager
      serviceAreas={serviceAreas.map((serviceArea) => ({
        ...serviceArea,
        publicTipUrl: getServiceAreaTipUrl(serviceArea.id),
      }))}
      venues={venues}
      departments={departments}
      defaultSelectedVenueId={defaultVenueId}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
    />
  );
}
