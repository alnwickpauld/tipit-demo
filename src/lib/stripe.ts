import Stripe from "stripe";

import { logger } from "./logger";

let stripeClient: Stripe | null = null;

export function hasStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isDevStripeBypassEnabled() {
  return process.env.TIPIT_DEV_FAKE_STRIPE === "true" || !hasStripeConfigured();
}

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil",
      appInfo: {
        name: "Tipit",
      },
    });
    logger.info("Stripe client initialized");
  }

  return stripeClient;
}
