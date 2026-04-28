import assert from "node:assert/strict";
import test from "node:test";

import { ValidationAppError } from "./shared/errors/app-error";
import { calculateTipOut } from "./domains/customer-admin/tip-out-rules/tip-out-rules.service";

test("tip-out maths uses 1.5 percent as 0.015 decimal fraction", () => {
  const result = calculateTipOut({
    totalSales: 2000,
    discounts: 50,
    availableTipBalance: 100,
    rateDecimal: 0.015,
  });

  assert.equal(result.netSales, 1950);
  assert.equal(result.requestedTipOutAmount, 29.25);
  assert.equal(result.tipOutAmount, 29.25);
  assert.equal(result.ratePercentage, 1.5);
});

test("tip-out calculation supports zero discounts", () => {
  const result = calculateTipOut({
    totalSales: 2000,
    discounts: 0,
    availableTipBalance: 100,
    rateDecimal: 0.015,
  });

  assert.equal(result.netSales, 2000);
  assert.equal(result.tipOutAmount, 30);
});

test("tip-out calculation supports zero sales", () => {
  const result = calculateTipOut({
    totalSales: 0,
    discounts: 0,
    availableTipBalance: 100,
    rateDecimal: 0.015,
  });

  assert.equal(result.netSales, 0);
  assert.equal(result.tipOutAmount, 0);
});

test("tip-out rejects negative discounts", () => {
  assert.throws(
    () =>
      calculateTipOut({
        totalSales: 2000,
        discounts: -1,
        availableTipBalance: 100,
        rateDecimal: 0.015,
      }),
    (error) =>
      error instanceof ValidationAppError &&
      error.message === "Discounts must be a valid positive amount or zero",
  );
});

test("tip-out cannot exceed available eligible tip balance when capping is disabled", () => {
  assert.throws(
    () =>
      calculateTipOut({
        totalSales: 2000,
        discounts: 50,
        availableTipBalance: 20,
        rateDecimal: 0.015,
        capAtAvailableTipBalance: false,
      }),
    (error) =>
      error instanceof ValidationAppError &&
      error.message === "Tip-out cannot exceed the available eligible tip balance",
  );
});

test("tip-out caps to available eligible tip balance when configured", () => {
  const result = calculateTipOut({
    totalSales: 2000,
    discounts: 50,
    availableTipBalance: 20,
    rateDecimal: 0.015,
    capAtAvailableTipBalance: true,
  });

  assert.equal(result.requestedTipOutAmount, 29.25);
  assert.equal(result.tipOutAmount, 20);
  assert.equal(result.remainingTipBalanceAmount, 0);
  assert.equal(result.wasCapped, true);
});
