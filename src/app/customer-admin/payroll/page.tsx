import { CustomerPayrollSettingsManager } from "../../../components/customer-admin/customer-payroll-settings-manager";
import { requireCustomerUser } from "../../../lib/admin-session";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerPayrollPage() {
  const user = await requireCustomerUser();
  const customer = await prisma.customer.findUniqueOrThrow({
    where: { id: user.customerId! },
    include: {
      payrollConfig: true,
    },
  });

  return (
    <CustomerPayrollSettingsManager
      customer={customer}
      canManage={user.role === "CUSTOMER_ADMIN"}
    />
  );
}
