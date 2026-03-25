import { SettlementFrequency } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { prisma } from "../../../../lib/prisma";
import { NotFoundError } from "../../../shared/errors/app-error";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
} from "./customers.schemas";

function percentToBps(percent: number) {
  return Math.round(percent * 100);
}

function mapCustomerResponse(
  customer: Awaited<ReturnType<CustomersService["loadCustomerOrThrow"]>>,
) {
  return {
    id: customer.id,
    name: customer.name,
    slug: customer.slug,
    legalName: customer.legalName,
    billingEmail: customer.contactEmail,
    contactPhone: customer.contactPhone,
    status: customer.status,
    tipitFeePercent: customer.tipitFeeBps / 100,
    payrollFrequency: customer.payrollConfig?.frequency ?? null,
    payrollAnchorDate: customer.payrollConfig?.payPeriodAnchor ?? null,
    settlementFrequency:
      customer.payrollConfig?.settlementFrequency ?? SettlementFrequency.WEEKLY,
    currency: customer.currency,
    timezone: customer.timezone,
    venueCount: customer._count.venues,
    customerUserCount: customer._count.customerUsers,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export class CustomersService {
  constructor(
    private readonly db: Pick<PrismaClient, "customer" | "payrollConfig" | "$transaction"> = prisma,
  ) {}

  async list() {
    const customers = await this.db.customer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        payrollConfig: true,
        _count: {
          select: {
            venues: true,
            customerUsers: true,
          },
        },
      },
    });

    return customers.map(mapCustomerResponse);
  }

  async getById(customerId: string) {
    return mapCustomerResponse(await this.loadCustomerOrThrow(customerId));
  }

  async create(input: CreateCustomerInput) {
    const customer = await this.db.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name: input.name,
          slug: input.slug,
          legalName: input.legalName,
          contactEmail: input.billingEmail,
          contactPhone: input.contactPhone,
          status: input.status,
          tipitFeeBps: percentToBps(input.tipitFeePercent),
          currency: input.currency,
          timezone: input.timezone,
        },
      });

      await tx.payrollConfig.create({
        data: {
          customerId: created.id,
          frequency: input.payrollFrequency,
          payPeriodAnchor: input.payrollAnchorDate,
          settlementFrequency: input.settlementFrequency,
        },
      });

      return created.id;
    });

    return this.getById(customer);
  }

  async update(customerId: string, input: UpdateCustomerInput) {
    await this.loadCustomerOrThrow(customerId);

    await this.db.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          name: input.name,
          slug: input.slug,
          legalName: input.legalName,
          contactEmail: input.billingEmail,
          contactPhone: input.contactPhone,
          status: input.status,
          tipitFeeBps:
            input.tipitFeePercent === undefined ? undefined : percentToBps(input.tipitFeePercent),
          currency: input.currency,
          timezone: input.timezone,
        },
      });

      if (
        input.payrollFrequency !== undefined ||
        input.payrollAnchorDate !== undefined ||
        input.settlementFrequency !== undefined
      ) {
        await tx.payrollConfig.upsert({
          where: { customerId },
          create: {
            customerId,
            frequency: input.payrollFrequency ?? "WEEKLY",
            payPeriodAnchor: input.payrollAnchorDate,
            settlementFrequency: input.settlementFrequency ?? SettlementFrequency.WEEKLY,
          },
          update: {
            frequency: input.payrollFrequency,
            payPeriodAnchor: input.payrollAnchorDate,
            settlementFrequency: input.settlementFrequency,
          },
        });
      }
    });

    return this.getById(customerId);
  }

  async updateStatus(customerId: string, input: UpdateCustomerStatusInput) {
    await this.loadCustomerOrThrow(customerId);

    await this.db.customer.update({
      where: { id: customerId },
      data: { status: input.status },
    });

    return this.getById(customerId);
  }

  private async loadCustomerOrThrow(customerId: string) {
    const customer = await this.db.customer.findUnique({
      where: { id: customerId },
      include: {
        payrollConfig: true,
        _count: {
          select: {
            venues: true,
            customerUsers: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    return customer;
  }
}
