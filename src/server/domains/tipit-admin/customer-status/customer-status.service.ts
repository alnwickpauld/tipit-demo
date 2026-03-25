import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";

export class CustomerStatusService {
  async list() {
    return prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async update(customerId: string, status: "ACTIVE" | "INACTIVE" | "SUSPENDED") {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return prisma.customer.update({
      where: { id: customerId },
      data: { status },
    });
  }
}
