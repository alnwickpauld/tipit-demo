import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { logger, toLoggableError } from "../../../../lib/logger";
import { prisma } from "../../../../lib/prisma";
import { getStripe } from "../../../../lib/stripe";
import { finalizeTipTransaction } from "../../../../lib/tip-settlement";

export const dynamic = "force-dynamic";

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET;
}

async function markTipFailed(tipTransactionId: string, stripeCheckoutId?: string) {
  await prisma.tipTransaction.update({
    where: { id: tipTransactionId },
    data: {
      status: "FAILED",
      stripeCheckoutId: stripeCheckoutId,
    },
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = getWebhookSecret();

  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    logger.error("Stripe webhook invoked without required configuration");
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.warn("Invalid Stripe webhook signature", { error: toLoggableError(error) });
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tipTransactionId = session.metadata?.tipTransactionId;

        if (!tipTransactionId) {
          logger.warn("Stripe checkout session missing tipTransactionId", {
            eventId: event.id,
            sessionId: session.id,
          });
          break;
        }

        await finalizeTipTransaction(tipTransactionId, session.id);
        logger.info("Stripe checkout settled", {
          eventId: event.id,
          sessionId: session.id,
          tipTransactionId,
        });
        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tipTransactionId = session.metadata?.tipTransactionId;

        if (!tipTransactionId) {
          break;
        }

        await markTipFailed(tipTransactionId, session.id);
        logger.warn("Stripe checkout failed or expired", {
          eventId: event.id,
          sessionId: session.id,
          tipTransactionId,
          eventType: event.type,
        });
        break;
      }

      default:
        logger.info("Stripe webhook ignored", {
          eventId: event.id,
          eventType: event.type,
        });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      error: toLoggableError(error),
    });
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
