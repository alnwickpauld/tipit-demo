import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";

export class PayrollSettingsService {
  async get(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        payrollConfig: true,
        timezone: true,
        currency: true,
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return customer;
  }

  async update(
    customerId: string,
    input: Partial<{
      frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
      settlementFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
      payPeriodAnchor: Date;
      settlementDay: number;
      exportEmail: string;
      notes: string;
      timezone: string;
      currency: string;
    }>,
  ) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const { timezone, currency, ...payrollConfigInput } = input;

    return prisma.customer.update({
      where: { id: customerId },
      data: {
        timezone,
        currency,
        payrollConfig: {
          upsert: {
            create: {
              frequency: payrollConfigInput.frequency ?? "WEEKLY",
              settlementFrequency: payrollConfigInput.settlementFrequency ?? "WEEKLY",
              payPeriodAnchor: payrollConfigInput.payPeriodAnchor,
              settlementDay: payrollConfigInput.settlementDay,
              exportEmail: payrollConfigInput.exportEmail,
              notes: payrollConfigInput.notes,
            },
            update: payrollConfigInput,
          },
        },
      },
      select: {
        id: true,
        name: true,
        payrollConfig: true,
        timezone: true,
        currency: true,
      },
    });
  }
}
