import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST as startCheckout } from "../app/api/tip/checkout/route";
import { GET as getTipPageData } from "../app/api/tip/[slug]/route";
import { prisma } from "../lib/prisma";

test("public tip flow works end-to-end without authentication", async () => {
  const pageResponse = await getTipPageData(
    new Request("http://localhost/api/tip/ssn-room-service-tray-card"),
    {
      params: Promise.resolve({ slug: "ssn-room-service-tray-card" }),
    },
  );

  assert.equal(pageResponse.status, 200);

  const checkoutResponse = await startCheckout(
    new NextRequest("http://localhost/api/tip/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        slug: "ssn-room-service-tray-card",
        amount: 10,
        paymentMethod: "CARD",
      }),
    }),
  );

  assert.equal(checkoutResponse.status, 200);

  const payload = (await checkoutResponse.json()) as {
    url: string;
  };
  const checkoutUrl = new URL(payload.url);
  const tipTransactionId = checkoutUrl.searchParams.get("tip_transaction_id");

  assert.equal(checkoutUrl.pathname, "/tip/ssn-room-service-tray-card/success");
  assert.equal(checkoutUrl.searchParams.get("demo"), "1");
  assert.ok(tipTransactionId);

  const tipTransaction = await prisma.tipTransaction.findUniqueOrThrow({
    where: { id: tipTransactionId! },
    include: {
      allocationResults: true,
    },
  });

  assert.equal(tipTransaction.status, "SUCCEEDED");
  assert.equal(tipTransaction.qrCodeSlug, "ssn-room-service-tray-card");
  assert.equal(tipTransaction.guestSelectionType, "TEAM");
  assert.ok(tipTransaction.allocationResults.length > 0);
});
