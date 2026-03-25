import { CustomerVenuesManager } from "../../../components/customer-admin/customer-venues-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";

export default async function CustomerVenuesPage() {
  const user = await requireCustomerUser();
  const venues = await prisma.venue.findMany({
    where: { customerId: user.customerId! },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      code: true,
      type: true,
      timezone: true,
      status: true,
      city: true,
      country: true,
      brandBackgroundColor: true,
      brandTextColor: true,
      brandButtonColor: true,
      brandButtonTextColor: true,
      brandLogoImageUrl: true,
      _count: {
        select: {
          staffMembers: true,
          pools: true,
          allocationRules: true,
        },
      },
    },
  });

  return (
    <CustomerVenuesManager
      venues={venues}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
    />
  );

  return (
    <section className="rounded-[1.8rem] border border-[#d8deea] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Venues</p>
      <h2 className="mt-2 text-2xl text-[#101828]">Customer venues</h2>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-[#e2e8f3]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#f7f9fc] text-[#6d7b91]">
            <tr>
              <th className="px-4 py-3 font-semibold">Venue</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Timezone</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {venues.map((venue) => (
              <tr key={venue.id} className="border-t border-[#e2e8f3]">
                <td className="px-4 py-4">
                  <p className="font-semibold text-[#101828]">{venue.name}</p>
                  <p className="text-[#66748b]">{venue.code ?? venue.slug}</p>
                </td>
                <td className="px-4 py-4 text-[#243147]">{venue.type ?? "OTHER"}</td>
                <td className="px-4 py-4 text-[#243147]">
                  {venue.timezone ?? "Customer default"}
                </td>
                <td className="px-4 py-4 text-[#243147]">{venue.status}</td>
                <td className="px-4 py-4 text-[#66748b]">
                  {venue._count.staffMembers} staff · {venue._count.pools} pools ·{" "}
                  {venue._count.allocationRules} rules
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
