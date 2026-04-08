import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { amountToMinorUnits } from "../../../../lib/currency";
import { logger, toLoggableError } from "../../../../lib/logger";
import { getPublicTipDestinationBySlug } from "../../../../lib/public-tip";
import { resolveTipSelectionFromPublicFlow } from "../../../../lib/public-tip-selection";
import { prisma } from "../../../../lib/prisma";
import { getStripe, isDevStripeBypassEnabled } from "../../../../lib/stripe";
import { createTipTransaction, finalizeTipTransaction } from "../../../../lib/tip-settlement";

const checkoutPayloadSchema = z.object({
  slug: z.string().min(1),
  amount: z.coerce.number().min(1).max(500),
  paymentMethod: z.enum(["CARD", "APPLE_PAY", "PAYPAL"]).default("CARD"),
  selectedRecipientMode: z.enum(["TEAM", "INDIVIDUAL"]).optional(),
  selectedStaffMemberId: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = checkoutPayloadSchema.parse(await request.json());
    const destination = await getPublicTipDestinationBySlug(payload.slug);

    if (!destination) {
      return NextResponse.json({ error: "QR destination not found." }, { status: 404 });
    }

    let resolvedSelection;
    try {
      resolvedSelection = resolveTipSelectionFromPublicFlow({
        destination,
        selectedRecipientMode: payload.selectedRecipientMode,
        selectedStaffMemberId: payload.selectedStaffMemberId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === "SELECTED_STAFF_MEMBER_REQUIRED" ||
          error.message === "INVALID_RECIPIENT_SELECTION")
      ) {
        return NextResponse.json({ error: "Selected team member is not available." }, { status: 400 });
      }

      throw error;
    }

    const effectiveDestination = resolvedSelection.resolvedDestination;

    const customer = await prisma.customer.findUnique({
      where: { id: effectiveDestination.customerId },
      select: {
        tipitFeeBps: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    }

    const grossAmount = Number(payload.amount.toFixed(2));
    const tipitFeeAmount = Number(
      ((grossAmount * customer.tipitFeeBps) / 10_000).toFixed(2),
    );
    const netAmount = Number((grossAmount - tipitFeeAmount).toFixed(2));

    const tipTransaction = await createTipTransaction({
      destination: effectiveDestination,
      grossAmount,
      tipitFeeAmount,
      netAmount,
      guestSelectionType: resolvedSelection.guestSelectionType,
      status: "PENDING",
    });

    if (isDevStripeBypassEnabled()) {
      await finalizeTipTransaction(tipTransaction.id);
      logger.info("Tip checkout completed in local demo mode", {
        tipTransactionId: tipTransaction.id,
        destinationType: effectiveDestination.destinationType,
        paymentMethod: payload.paymentMethod,
      });

      return NextResponse.json({
        url: `${request.nextUrl.origin}/tip/${payload.slug}/success?demo=1&amount=${grossAmount.toFixed(2)}&tip_transaction_id=${tipTransaction.id}&payment_method=${payload.paymentMethod}`,
      });
    }

    if (payload.paymentMethod === "PAYPAL") {
      return NextResponse.json(
        {
          error:
            "PayPal is available in local demo mode, but it is not configured for hosted checkout in this environment yet.",
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${request.nextUrl.origin}/tip/${payload.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/tip/${payload.slug}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: destination.currency.toLowerCase(),
            unit_amount: amountToMinorUnits(grossAmount),
            product_data: {
              name: `Tip for ${effectiveDestination.targetName}`,
              description: `${effectiveDestination.venueName} via Tipit`,
            },
          },
        },
      ],
      metadata: {
        slug: payload.slug,
        customerId: effectiveDestination.customerId,
        venueId: effectiveDestination.venueId,
        destinationType: effectiveDestination.destinationType,
        guestSelectionType: resolvedSelection.guestSelectionType,
        grossAmount: grossAmount.toFixed(2),
        tipitFeeAmount: tipitFeeAmount.toFixed(2),
        netAmount: netAmount.toFixed(2),
        tipTransactionId: tipTransaction.id,
        paymentMethod: payload.paymentMethod,
        selectedStaffMemberId: effectiveDestination.destinationEmployeeId ?? "",
      },
    });

    await prisma.tipTransaction.update({
      where: { id: tipTransaction.id },
      data: {
        stripeCheckoutId: session.id,
      },
    });

    logger.info("Stripe checkout session created", {
      tipTransactionId: tipTransaction.id,
      checkoutSessionId: session.id,
      destinationType: effectiveDestination.destinationType,
      paymentMethod: payload.paymentMethod,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid tip amount." }, { status: 400 });
    }

    logger.error("Tip checkout failed", {
      error: toLoggableError(error),
    });

    return NextResponse.json(
      { error: "Unable to start payment right now. Please try again." },
      { status: 500 },
    );
  }
}
