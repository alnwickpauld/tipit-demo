import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";

export class FeeSettingsService {
  async list() {
    return prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        tipitFeeBps: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async update(customerId: string, tipitFeeBps: number) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return prisma.customer.update({
      where: { id: customerId },
      data: { tipitFeeBps },
    });
  }
}
