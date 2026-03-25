import { CustomersManager } from "../../../components/admin/customers-manager";
import { CustomersService } from "../../../server/domains/tipit-admin/customers/customers.service";

export default async function AdminCustomersPage() {
  const customers = await new CustomersService().list();

  return <CustomersManager customers={customers} />;
}
