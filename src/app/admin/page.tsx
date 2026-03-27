import Link from "next/link";

import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, "")}%`;
}

export default async function TipitAdminPage() {
  const [customers, customerUsers, counts] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        payrollConfig: true,
        _count: {
          select: {
            venues: true,
            customerUsers: true,
          },
        },
      },
    }),
    prisma.customerUser.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        role: true,
        customer: true,
        user: true,
      },
    }),
    prisma.$transaction([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: "ACTIVE" } }),
      prisma.venue.count(),
      prisma.staffMember.count({ where: { status: "ACTIVE" } }),
    ]),
  ]);

  const [totalCustomers, activeCustomers, totalVenues, activeStaff] = counts;

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Customers", value: totalCustomers, tone: "border-[#5f4d10] text-[#f5d31d]" },
          { label: "Active customers", value: activeCustomers, tone: "border-[#5f4d10] text-[#f5d31d]" },
          { label: "Venues", value: totalVenues, tone: "border-[#5f4d10] text-[#f5d31d]" },
          { label: "Active staff", value: activeStaff, tone: "border-[#5f4d10] text-[#f5d31d]" },
        ].map((card) => (
          <article
            key={card.label}
            className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${card.tone}`}
            >
              {card.label}
            </div>
            <p className="mt-5 text-4xl font-semibold text-white">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">
                Hospitality groups
              </p>
              <h2 className="mt-2 text-2xl text-white">Recent customers</h2>
            </div>
            <Link
              href="/admin/customers"
              className="rounded-full border border-[#f5d31d] bg-[#f5d31d] px-4 py-2 text-sm font-semibold text-[#050505] no-underline transition hover:opacity-90"
            >
              View all customers
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#171717]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[#060606] text-[#8f8f8f]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Fee</th>
                  <th className="px-4 py-3 font-semibold">Payroll</th>
                  <th className="px-4 py-3 font-semibold">Scale</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-t border-[#171717] bg-[#0b0b0b]">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">{customer.name}</p>
                      <p className="text-[#8f8f8f]">{customer.contactEmail}</p>
                    </td>
                    <td className="px-4 py-4 text-[#d7d7d7]">{customer.status}</td>
                    <td className="px-4 py-4 text-[#d7d7d7]">
                      {formatPercent(customer.tipitFeeBps / 100)}
                    </td>
                    <td className="px-4 py-4 text-[#d7d7d7]">
                      {customer.payrollConfig?.frequency ?? "Not set"}
                    </td>
                    <td className="px-4 py-4 text-[#8f8f8f]">
                      {customer._count.venues} venues / {customer._count.customerUsers} users
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[1.8rem] border border-[#151515] bg-[#090909] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8d8d8d]">
            Customer access
          </p>
          <h2 className="mt-2 text-2xl text-white">Recently created users</h2>
          <div className="mt-6 grid gap-3">
            {customerUsers.map((membership) => (
              <div
                key={membership.id}
                className="rounded-[1.4rem] border border-[#171717] bg-[#0b0b0b] px-4 py-4"
              >
                <p className="font-semibold text-white">
                  {membership.user.firstName} {membership.user.lastName}
                </p>
                <p className="text-sm text-[#bdbdbd]">
                  {membership.customer.name} / {membership.role.code}
                </p>
                <p className="mt-2 text-sm text-[#8f8f8f]">{membership.user.email}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
