import { CustomerPoolsManager } from "../../../components/customer-admin/customer-pools-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";
import { getPoolTipUrl } from "../../../lib/public-tip-links";

export const dynamic = "force-dynamic";

export default async function CustomerPoolsPage() {
  const user = await requireCustomerUser();
  const [pools, venues, staffMembers] = await Promise.all([
    prisma.pool.findMany({
      where: { customerId: user.customerId! },
      orderBy: [{ venue: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        status: true,
        venueId: true,
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          where: { isActive: true },
          select: {
            id: true,
            isActive: true,
            staffMemberId: true,
            staffMember: {
              select: {
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
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
  ]);
  const poolsWithUrls = pools.map((pool) => ({
    ...pool,
    publicTipUrl: getPoolTipUrl(pool.id),
  }));
  const defaultVenueId =
    venues.find((venue) => venue.name === "Sandman Signature Newcastle")?.id ?? venues[0]?.id ?? "";

  return (
    <CustomerPoolsManager
      pools={poolsWithUrls}
      venues={venues}
      staffMembers={staffMembers}
      defaultSelectedVenueId={defaultVenueId}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
    />
  );

  return (
    <section className="rounded-[1.8rem] border border-[#d8deea] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Pools</p>
      <h2 className="mt-2 text-2xl text-[#101828]">Tip distribution pools</h2>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {pools.map((pool) => (
          <article
            key={pool.id}
            className="rounded-[1.5rem] border border-[#e2e8f3] bg-[#f9fbff] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-[#101828]">{pool.name}</p>
                <p className="mt-1 text-sm text-[#5f6f86]">
                  {pool.venue.name} · {pool.status}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#4d5b72]">
                {pool.members.length} members
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {pool.members.map((member) => (
                <span
                  key={member.id}
                  className="rounded-full border border-[#d8deea] bg-white px-3 py-2 text-xs font-semibold text-[#223047]"
                >
                  {member.staffMember.displayName ??
                    `${member.staffMember.firstName} ${member.staffMember.lastName}`}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
