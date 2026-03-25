import { NextResponse } from "next/server";

import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "tipit",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
      database: "up",
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      uptimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "tipit",
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
        database: "down",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
