import { CustomerStaffManager } from "../../../components/customer-admin/customer-staff-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";
import { getStaffTipUrl } from "../../../lib/public-tip-links";

export const dynamic = "force-dynamic";

export default async function CustomerStaffPage() {
  const user = await requireCustomerUser();
  const staffMembers = await prisma.staffMember.findMany({
    where: { customerId: user.customerId! },
    orderBy: [{ venue: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      venueId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      staffCode: true,
      externalPayrollRef: true,
      status: true,
      venue: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  const venues = await prisma.venue.findMany({
    where: { customerId: user.customerId! },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });
  const staffWithUrls = staffMembers.map((staffMember) => ({
    ...staffMember,
    publicTipUrl: getStaffTipUrl(staffMember.id),
  }));

  return (
    <CustomerStaffManager
      staffMembers={staffWithUrls}
      venues={venues}
      canManage={user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_MANAGER"}
    />
  );

  return (
    <section className="rounded-[1.8rem] border border-[#d8deea] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <p className="text-xs uppercase tracking-[0.26em] text-[#70809b]">Staff</p>
      <h2 className="mt-2 text-2xl text-[#101828]">Team directory</h2>

      <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-[#e2e8f3]">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#f7f9fc] text-[#6d7b91]">
            <tr>
              <th className="px-4 py-3 font-semibold">Staff member</th>
              <th className="px-4 py-3 font-semibold">Venue</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Payroll ref</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {staffMembers.map((staffMember) => (
              <tr key={staffMember.id} className="border-t border-[#e2e8f3]">
                <td className="px-4 py-4">
                  <p className="font-semibold text-[#101828]">
                    {staffMember.displayName ??
                      `${staffMember.firstName} ${staffMember.lastName}`}
                  </p>
                  <p className="text-[#66748b]">{staffMember.staffCode ?? "No staff code"}</p>
                </td>
                <td className="px-4 py-4 text-[#243147]">{staffMember.venue.name}</td>
                <td className="px-4 py-4 text-[#243147]">{staffMember.email ?? "Not set"}</td>
                <td className="px-4 py-4 text-[#243147]">
                  {staffMember.externalPayrollRef ?? "Not set"}
                </td>
                <td className="px-4 py-4 text-[#243147]">{staffMember.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
