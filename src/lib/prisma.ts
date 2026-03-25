import { PrismaClient } from "@prisma/client";

import { logger } from "./logger";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

prisma.$on("error", (event) => {
  logger.error("Prisma client error", {
    message: event.message,
    target: event.target,
    timestamp: event.timestamp,
  });
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
