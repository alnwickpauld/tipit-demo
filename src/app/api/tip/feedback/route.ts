import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "../../../../lib/prisma";

const feedbackSchema = z.object({
  tipTransactionId: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z
    .string()
    .trim()
    .max(500, "Comment must be 500 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
}).superRefine((value, context) => {
  if (typeof value.rating !== "number" && !value.comment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add a rating, a comment, or both.",
      path: ["rating"],
    });
  }
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
        rating: true,
        comment: true,
        reviewIntegrationStatus: true,
      },
    });

    if (!tipTransaction) {
      return NextResponse.json({ error: "Tip transaction not found." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.tipTransaction.update({
        where: { id: tipTransaction.id },
        data: {
          rating: payload.rating ?? tipTransaction.rating,
          comment: payload.comment ?? tipTransaction.comment,
          ratedAt: new Date(),
          reviewIntegrationStatus:
            typeof payload.rating === "number" && payload.rating >= 4
              ? "ELIGIBLE"
              : tipTransaction.rating || payload.comment
                ? tipTransaction.reviewIntegrationStatus
                : "NOT_REQUESTED",
        },
      }),
      prisma.auditLog.create({
        data: {
          customerId: tipTransaction.customerId,
          venueId: tipTransaction.venueId,
          entityType: "TIP_TRANSACTION",
          entityId: tipTransaction.id,
          action: "FEEDBACK_SUBMITTED",
          summary:
            typeof payload.rating === "number" && payload.comment
              ? `Guest submitted a ${payload.rating}-star rating and comment.`
              : typeof payload.rating === "number"
                ? `Guest submitted a ${payload.rating}-star rating.`
                : "Guest submitted written feedback.",
          metadata: {
            rating: payload.rating,
            comment: payload.comment,
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
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Enter valid feedback." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to save feedback right now. Please try again." },
      { status: 500 },
    );
  }
}
