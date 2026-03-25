import Link from "next/link";
import { redirect } from "next/navigation";

import { TipFeedbackCardLarge } from "../../../../components/tip-feedback-card-large";
import { formatCurrency } from "../../../../lib/currency";
import { getPublicTipDestinationBySlug } from "../../../../lib/public-tip";
import { getStripe, isDevStripeBypassEnabled } from "../../../../lib/stripe";
import { finalizeTipTransaction } from "../../../../lib/tip-settlement";

type SuccessPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    demo?: string;
    amount?: string;
    tip_transaction_id?: string;
    session_id?: string;
    payment_method?: string;
  }>;
};

export default async function TipSuccessPage({
  params,
  searchParams,
}: SuccessPageProps) {
  const [{ slug }, { demo, amount, tip_transaction_id: tipTransactionId, session_id: sessionId, payment_method: paymentMethodParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const destination = await getPublicTipDestinationBySlug(slug);

  if (!destination) {
    redirect("/");
  }

  let displayAmount: number | null = null;
  let settledTipTransactionId = tipTransactionId ?? null;
  let paymentMethodLabel =
    paymentMethodParam === "PAYPAL"
      ? "PayPal"
      : paymentMethodParam === "CARD"
        ? "Card"
        : paymentMethodParam === "APPLE_PAY"
          ? "Apple Pay"
          : null;

  if (demo === "1" && amount && tipTransactionId && isDevStripeBypassEnabled()) {
    await finalizeTipTransaction(tipTransactionId);

    const parsedAmount = Number(amount);
    if (Number.isFinite(parsedAmount)) {
      displayAmount = parsedAmount;
    }
  }

  if (!displayAmount && sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (
        session.payment_status === "paid" &&
        session.metadata?.tipTransactionId
      ) {
        await finalizeTipTransaction(session.metadata.tipTransactionId, session.id);
        settledTipTransactionId = session.metadata.tipTransactionId;
        paymentMethodLabel =
          session.metadata.paymentMethod === "PAYPAL"
            ? "PayPal"
            : session.metadata.paymentMethod === "CARD"
              ? "Card"
              : session.metadata.paymentMethod === "APPLE_PAY"
                ? "Apple Pay"
                : paymentMethodLabel;
      }

      if (typeof session.amount_total === "number") {
        displayAmount = session.amount_total / 100;
      }
    } catch {
      displayAmount = null;
    }
  }

  return (
    <main
      className="min-h-screen px-4 py-10 sm:px-6"
      style={{ backgroundColor: destination.brandBackgroundColor }}
    >
      <div
        className="mx-auto w-full max-w-sm rounded-[2rem] p-6 text-center"
        style={{
          backgroundColor: destination.brandBackgroundColor,
          color: destination.brandTextColor,
        }}
      >
        <img
          src={destination.brandLogoImageUrl || "/logo-black.png"}
          alt={destination.venueBrandName}
          className="mx-auto h-auto w-[220px] max-w-full object-contain"
        />
        <div className="mx-auto mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#2ed15b] text-[3rem] font-bold text-[#111111]">
          ✓
        </div>
        <h1
          className="mt-6 text-5xl font-semibold leading-tight"
          style={{ color: destination.brandTextColor }}
        >
          Thank you!
        </h1>
        <p className="mt-3 text-lg" style={{ color: destination.brandTextColor }}>
          Your tip has been received
        </p>
        <p className="mt-2 text-base" style={{ color: destination.brandTextColor }}>
          {destination.targetName} at {destination.venueName}
        </p>

        {displayAmount ? (
          <div className="mt-8 rounded-2xl bg-white px-5 py-4 shadow-[0_12px_30px_rgba(17,17,17,0.08)]">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8f8f86]">
              Amount received
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#111111]">
              {formatCurrency(displayAmount, destination.currency)}
            </p>
            {paymentMethodLabel ? (
              <p className="mt-2 text-sm text-[#5f5f5f]">Paid via {paymentMethodLabel}</p>
            ) : null}
          </div>
        ) : null}

        <TipFeedbackCardLarge
          tipTransactionId={settledTipTransactionId}
          targetLabel={destination.destinationType === "POOL" ? "team" : "server"}
          textColor={destination.brandTextColor}
        />

        <Link
          href={`/tip/${slug}`}
          className="mt-8 inline-flex rounded-xl px-6 py-4 text-base font-semibold no-underline transition hover:opacity-90"
          style={{
            backgroundColor: destination.brandButtonColor,
            color: destination.brandButtonTextColor,
          }}
        >
          Tip again
        </Link>
      </div>
    </main>
  );
}
