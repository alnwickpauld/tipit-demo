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
          { label: "Customers", value: totalCustomers, tone: "border-[#d4c1ae] text-[#8d7762]" },
          { label: "Active customers", value: activeCustomers, tone: "border-[#d4c1ae] text-[#8d7762]" },
          { label: "Venues", value: totalVenues, tone: "border-[#d4c1ae] text-[#8d7762]" },
          { label: "Active staff", value: activeStaff, tone: "border-[#d4c1ae] text-[#8d7762]" },
        ].map((card) => (
          <article
            key={card.label}
            className="rounded-[1.8rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-5 shadow-[0_20px_60px_rgba(97,73,54,0.10)]"
          >
            <div
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${card.tone}`}
            >
              {card.label}
            </div>
            <p className="mt-5 text-4xl font-semibold text-[#43362f]">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[1.8rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-6 shadow-[0_20px_60px_rgba(97,73,54,0.10)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[#8c796b]">
                Hospitality groups
              </p>
              <h2 className="mt-2 text-2xl text-[#43362f]">Recent customers</h2>
            </div>
            <Link
              href="/admin/customers"
              className="rounded-full border border-[#b49e89] bg-[#b49e89] px-4 py-2 text-sm font-semibold text-[#fffaf4] no-underline transition hover:opacity-90"
            >
              View all customers
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#ddd0c0]">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-[#f3e9df] text-[#8c796b]">
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
                  <tr key={customer.id} className="border-t border-[#e4d7ca] bg-[rgba(255,252,248,0.72)]">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#43362f]">{customer.name}</p>
                      <p className="text-[#8f7a6c]">{customer.contactEmail}</p>
                    </td>
                    <td className="px-4 py-4 text-[#5d4d41]">{customer.status}</td>
                    <td className="px-4 py-4 text-[#5d4d41]">
                      {formatPercent(customer.tipitFeeBps / 100)}
                    </td>
                    <td className="px-4 py-4 text-[#5d4d41]">
                      {customer.payrollConfig?.frequency ?? "Not set"}
                    </td>
                    <td className="px-4 py-4 text-[#8f7a6c]">
                      {customer._count.venues} venues / {customer._count.customerUsers} users
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-[1.8rem] border border-[#d7c5b2] bg-[rgba(255,250,245,0.82)] p-6 shadow-[0_20px_60px_rgba(97,73,54,0.10)]">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8c796b]">
            Customer access
          </p>
          <h2 className="mt-2 text-2xl text-[#43362f]">Recently created users</h2>
          <div className="mt-6 grid gap-3">
            {customerUsers.map((membership) => (
              <div
                key={membership.id}
                className="rounded-[1.4rem] border border-[#e4d7ca] bg-[rgba(255,252,248,0.72)] px-4 py-4"
              >
                <p className="font-semibold text-[#43362f]">
                  {membership.user.firstName} {membership.user.lastName}
                </p>
                <p className="text-sm text-[#67574c]">
                  {membership.customer.name} / {membership.role.code}
                </p>
                <p className="mt-2 text-sm text-[#8f7a6c]">{membership.user.email}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
