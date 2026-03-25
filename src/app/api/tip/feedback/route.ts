import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "../../../../lib/prisma";

const feedbackSchema = z.object({
  tipTransactionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

export async function POST(request: NextRequest) {
  try {
    const payload = feedbackSchema.parse(await request.json());

    const tipTransaction = await prisma.tipTransaction.findUnique({
      where: { id: payload.tipTransactionId },
      select: {
        id: true,
        customerId: true,
        venueId: true,
        destinationType: true,
        destinationEmployeeId: true,
        destinationPoolId: true,
      },
    });

    if (!tipTransaction) {
      return NextResponse.json({ error: "Tip transaction not found." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.tipTransaction.update({
        where: { id: tipTransaction.id },
        data: {
          rating: payload.rating,
          ratedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          customerId: tipTransaction.customerId,
          venueId: tipTransaction.venueId,
          entityType: "TIP_TRANSACTION",
          entityId: tipTransaction.id,
          action: "FEEDBACK_SUBMITTED",
          summary: `Guest submitted a ${payload.rating}-star rating.`,
          metadata: {
            rating: payload.rating,
            destinationType: tipTransaction.destinationType,
            destinationEmployeeId: tipTransaction.destinationEmployeeId,
            destinationPoolId: tipTransaction.destinationPoolId,
          },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid star rating." }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Unable to save feedback right now. Please try again." },
      { status: 500 },
    );
  }
}
