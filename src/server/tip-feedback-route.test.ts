import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST } from "../app/api/tip/feedback/route";
import { prisma } from "../lib/prisma";

test("tip feedback route accepts comment-only feedback for a succeeded tip transaction", async () => {
  const serviceArea = await prisma.serviceArea.findFirstOrThrow({
    where: { slug: "ssn-room-service-tray-card" },
    include: {
      customer: true,
      venue: true,
    },
  });
  const payrollPeriod = await prisma.payrollPeriod.findFirstOrThrow({
    where: { customerId: serviceArea.customerId },
    orderBy: { startDate: "desc" },
  });
  const tipTransaction = await prisma.tipTransaction.create({
    data: {
      customerId: serviceArea.customerId,
      venueId: serviceArea.venueId,
      payrollPeriodId: payrollPeriod.id,
      qrCodeSlug: serviceArea.slug,
      destinationType: "SERVICE_AREA",
      destinationVenueId: serviceArea.venueId,
      destinationServiceAreaId: serviceArea.id,
      guestSelectionType: "TEAM",
      currency: serviceArea.customer.currency,
      grossAmount: 10,
      tipitFeeAmount: 0.5,
      netAmount: 9.5,
      status: "SUCCEEDED",
      occurredAt: new Date("2026-04-15T09:00:00.000Z"),
    },
  });

  try {
    const response = await POST(
      new NextRequest("http://localhost/api/tip/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tipTransactionId: tipTransaction.id,
          comment: "Lovely service and a very smooth breakfast experience.",
        }),
      }),
    );

    assert.equal(response.status, 200);

    const updated = await prisma.tipTransaction.findUniqueOrThrow({
      where: { id: tipTransaction.id },
      select: {
        comment: true,
        rating: true,
        reviewIntegrationStatus: true,
        ratedAt: true,
      },
    });

    assert.equal(updated.comment, "Lovely service and a very smooth breakfast experience.");
    assert.equal(updated.reviewIntegrationStatus, "NOT_REQUESTED");
    assert.ok(updated.ratedAt);
  } finally {
    await prisma.tipTransaction.delete({
      where: { id: tipTransaction.id },
    });
  }
});

test("tip feedback route stores rating and comment together and marks strong reviews as eligible", async () => {
  const tipTransaction = await prisma.tipTransaction.findFirstOrThrow({
    where: { status: "SUCCEEDED" },
    orderBy: { createdAt: "asc" },
  });

  const response = await POST(
    new NextRequest("http://localhost/api/tip/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tipTransactionId: tipTransaction.id,
        rating: 5,
        comment: "Excellent team service from start to finish.",
      }),
    }),
  );

  assert.equal(response.status, 200);

  const updated = await prisma.tipTransaction.findUniqueOrThrow({
    where: { id: tipTransaction.id },
    select: {
      comment: true,
      rating: true,
      reviewIntegrationStatus: true,
    },
  });

  assert.equal(updated.rating, 5);
  assert.equal(updated.comment, "Excellent team service from start to finish.");
  assert.equal(updated.reviewIntegrationStatus, "ELIGIBLE");
});

test("tip feedback route rejects empty submissions", async () => {
  const tipTransaction = await prisma.tipTransaction.findFirstOrThrow({
    where: { status: "SUCCEEDED" },
  });

  const response = await POST(
    new NextRequest("http://localhost/api/tip/feedback", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        tipTransactionId: tipTransaction.id,
      }),
    }),
  );

  assert.equal(response.status, 400);

  const payload = (await response.json()) as { error: string };
  assert.equal(payload.error, "Add a rating, a comment, or both.");
});
