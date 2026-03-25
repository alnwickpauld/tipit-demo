"use client";

import { useMemo, useState } from "react";

import { formatCurrency } from "../lib/currency";

const PRESET_AMOUNTS = [5, 10, 20];
const paymentMethods = [
  { value: "APPLE_PAY", label: "Apple Pay", shortLabel: "Apple" },
  { value: "CARD", label: "Card", shortLabel: "Card" },
  { value: "PAYPAL", label: "PayPal", shortLabel: "PayPal" },
] as const;

type PaymentMethod = (typeof paymentMethods)[number]["value"];

type TipFormProps = {
  slug: string;
  currency: string;
  targetName: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
};

export function TipForm({
  slug,
  currency,
  targetName,
  textColor,
  buttonColor,
  buttonTextColor,
}: TipFormProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState("");
  const [step, setStep] = useState<"amount" | "payment">("amount");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("APPLE_PAY");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosenAmount = useMemo(() => {
    if (customAmount.trim() !== "") {
      return Number(customAmount);
    }

    return selectedAmount;
  }, [customAmount, selectedAmount]);

  const currencySymbol = useMemo(() => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  }, [currency]);

  const paymentActionLabel =
    selectedPaymentMethod === "APPLE_PAY"
      ? "Pay with Apple Pay"
      : selectedPaymentMethod === "PAYPAL"
        ? "Pay with PayPal"
        : "Pay with card";

  function validateCardFields() {
    if (selectedPaymentMethod !== "CARD") {
      return true;
    }

    if (!cardName.trim()) {
      setError("Enter the name on card.");
      return false;
    }

    if (cardNumber.replace(/\s+/g, "").length < 12) {
      setError("Enter a valid card number.");
      return false;
    }

    if (!/^\d{2}\/\d{2}$/.test(cardExpiry.trim())) {
      setError("Enter expiry as MM/YY.");
      return false;
    }

    if (!/^\d{3,4}$/.test(cardCvc.trim())) {
      setError("Enter a valid CVC.");
      return false;
    }

    return true;
  }

  async function startCheckout() {
    if (!Number.isFinite(chosenAmount) || chosenAmount < 1) {
      setError("Enter a tip amount of at least 1.");
      setStep("amount");
      return;
    }

    if (!validateCardFields()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/tip/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug,
        amount: chosenAmount,
        paymentMethod: selectedPaymentMethod,
      }),
    });

    const payload = (await response.json()) as { url?: string; error?: string };

    if (!response.ok || !payload.url) {
      setIsSubmitting(false);
      setError(payload.error ?? "Unable to start checkout.");
      return;
    }

    window.location.assign(payload.url);
  }

  return (
    <div className="mt-10">
      {step === "amount" ? (
        <section className="space-y-4 text-center">
          <div>
            <h2 className="text-[2rem] font-semibold" style={{ color: textColor }}>
              Tip {targetName}
            </h2>
            <p className="mt-2 text-base" style={{ color: textColor }}>
              Support exceptional services.
            </p>
          </div>

          <div className="space-y-3">
            {PRESET_AMOUNTS.map((amount) => {
              const isSelected = customAmount === "" && selectedAmount === amount;

              return (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount("");
                    setError(null);
                    setStep("payment");
                  }}
                  className={`w-full rounded-xl border px-5 py-4 text-2xl font-semibold transition ${
                    isSelected ? "border-transparent" : "border-[#1f1f1f] bg-white"
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: buttonColor, color: buttonTextColor }
                      : { color: textColor }
                  }
                >
                  {formatCurrency(amount, currency)}
                </button>
              );
            })}

            <div className="rounded-xl border border-[#1f1f1f] bg-white px-4 py-3">
              <label htmlFor="custom-amount" className="sr-only">
                Custom tip amount
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold text-[#111111]">{currencySymbol}</span>
                <input
                  id="custom-amount"
                  inputMode="decimal"
                  pattern="^\d+([.]\d{0,2})?$"
                  placeholder="Custom"
                  value={customAmount}
                  onChange={(event) => {
                    setCustomAmount(event.target.value);
                    setError(null);
                  }}
                  className="w-full border-none bg-transparent text-xl font-semibold text-[#111111] outline-none placeholder:text-[#767676]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!Number.isFinite(chosenAmount) || chosenAmount < 1) {
                  setError("Enter a tip amount of at least 1.");
                  return;
                }
                setStep("payment");
              }}
              className="w-full rounded-xl border border-[#1f1f1f] bg-white px-5 py-4 text-2xl font-semibold"
              style={{ color: textColor }}
            >
              Custom
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <button
            type="button"
            onClick={() => setStep("amount")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            aria-label="Go back"
          >
            ?
          </button>

          <div className="text-center">
            <h2 className="text-[2rem] font-semibold" style={{ color: textColor }}>
              Tip {targetName}
            </h2>
          </div>

          <div
            className="rounded-xl px-5 py-4 text-center text-2xl font-semibold"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            Tip: {formatCurrency(Number.isFinite(chosenAmount) ? chosenAmount : 0, currency)}
          </div>

          <div>
            <p className="text-center text-base font-medium" style={{ color: textColor }}>
              Choose payment method:
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {paymentMethods.map((method) => {
                const isSelected = selectedPaymentMethod === method.value;

                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method.value)}
                    className={`rounded-2xl border px-3 py-4 text-sm font-semibold transition ${
                      isSelected
                        ? "border-[#111111] bg-white shadow-[0_8px_20px_rgba(17,17,17,0.12)]"
                        : "border-[#d4d4d4] bg-white"
                    }`}
                    style={{ color: isSelected ? textColor : "#6a6a6a" }}
                  >
                    {method.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPaymentMethod === "CARD" ? (
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.08)]">
              <label className="block text-left">
                <span className="text-sm font-medium text-[#333333]">Name on card</span>
                <input
                  value={cardName}
                  onChange={(event) => {
                    setCardName(event.target.value);
                    setError(null);
                  }}
                  placeholder="Jane Smith"
                  className="mt-2 w-full rounded-xl border border-[#d4d4d4] bg-white px-4 py-3 text-base text-[#111111] outline-none"
                />
              </label>

              <label className="block text-left">
                <span className="text-sm font-medium text-[#333333]">Card number</span>
                <input
                  value={cardNumber}
                  onChange={(event) => {
                    setCardNumber(event.target.value);
                    setError(null);
                  }}
                  inputMode="numeric"
                  placeholder="1234 1234 1234 1234"
                  className="mt-2 w-full rounded-xl border border-[#d4d4d4] bg-white px-4 py-3 text-base text-[#111111] outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-left">
                  <span className="text-sm font-medium text-[#333333]">Expiry</span>
                  <input
                    value={cardExpiry}
                    onChange={(event) => {
                      setCardExpiry(event.target.value);
                      setError(null);
                    }}
                    inputMode="numeric"
                    placeholder="MM/YY"
                    className="mt-2 w-full rounded-xl border border-[#d4d4d4] bg-white px-4 py-3 text-base text-[#111111] outline-none"
                  />
                </label>

                <label className="block text-left">
                  <span className="text-sm font-medium text-[#333333]">CVC</span>
                  <input
                    value={cardCvc}
                    onChange={(event) => {
                      setCardCvc(event.target.value);
                      setError(null);
                    }}
                    inputMode="numeric"
                    placeholder="123"
                    className="mt-2 w-full rounded-xl border border-[#d4d4d4] bg-white px-4 py-3 text-base text-[#111111] outline-none"
                  />
                </label>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={startCheckout}
            disabled={isSubmitting}
            className="w-full rounded-xl px-6 py-4 text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
          >
            {isSubmitting ? "Opening checkout..." : paymentActionLabel}
          </button>
        </section>
      )}

      {error ? (
        <p className="mt-5 rounded-2xl border border-[#d9b2a6] bg-[#fff3ef] px-4 py-3 text-sm text-[#8b3c27]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
