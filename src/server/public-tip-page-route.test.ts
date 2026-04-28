import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../app/api/tip/[slug]/route";

test("public tip page data endpoint resolves without authentication and returns a safe payload", async () => {
  const response = await GET(new Request("http://localhost/api/tip/ssn-breakfast-table-card-a"), {
    params: Promise.resolve({ slug: "ssn-breakfast-table-card-a" }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=15, stale-while-revalidate=45");

  const payload = (await response.json()) as {
    data: Record<string, unknown> & {
      slug: string;
      heading: string;
      destinationType: string;
      serviceAreaJourney: {
        tippingMode: string;
      } | null;
    };
  };

  assert.equal(payload.data.slug, "ssn-breakfast-table-card-a");
  assert.equal(payload.data.destinationType, "SERVICE_AREA");
  assert.equal(payload.data.heading, "Tip the Breakfast Team");
  assert.ok(payload.data.serviceAreaJourney);
  assert.equal("customerId" in payload.data, false);
  assert.equal("venueId" in payload.data, false);
  assert.equal("destinationEmployeeId" in payload.data, false);
  assert.equal("destinationPoolId" in payload.data, false);
  assert.equal("qrCodeId" in payload.data, false);
});

test("public tip page data endpoint returns 404 for an unknown slug without authentication", async () => {
  const response = await GET(new Request("http://localhost/api/tip/not-a-real-qr"), {
    params: Promise.resolve({ slug: "not-a-real-qr" }),
  });

  assert.equal(response.status, 404);
});
