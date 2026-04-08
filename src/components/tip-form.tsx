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
  destinationType: "EMPLOYEE" | "POOL" | "VENUE" | "SERVICE_AREA";
  serviceAreaJourney: {
    departmentName: string;
    tippingMode: "TEAM_ONLY" | "INDIVIDUAL_ONLY" | "TEAM_OR_INDIVIDUAL" | "SHIFT_SELECTOR";
    displayMode: "FIXED_SIGN" | "TABLE_CARD" | "BILL_FOLDER" | "COUNTER_SIGN" | "EVENT_SIGN" | "OTHER";
    showTeamOption: boolean;
    selectionUi: "LIST" | "DROPDOWN";
    individualTippingUnavailable: boolean;
    individualTippingMessage: string | null;
    activeShiftStaff: Array<{
      id: string;
      displayName: string;
      roleLabel?: string;
      sortOrder: number;
    }>;
  } | null;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
};

export function TipForm({
  slug,
  currency,
  targetName,
  destinationType,
  serviceAreaJourney,
  textColor,
  buttonColor,
  buttonTextColor,
  backgroundColor,
}: TipFormProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState("");
  const tippingMode = serviceAreaJourney?.tippingMode ?? null;
  const departmentName = serviceAreaJourney?.departmentName ?? null;
  const displayMode = serviceAreaJourney?.displayMode ?? null;
  const individualTippingUnavailable = serviceAreaJourney?.individualTippingUnavailable ?? false;
  const individualTippingMessage = serviceAreaJourney?.individualTippingMessage ?? null;
  const serviceAreaStaffOptions = serviceAreaJourney?.activeShiftStaff ?? [];
  const showTeamOption = serviceAreaJourney?.showTeamOption ?? false;
  const selectionUi = serviceAreaJourney?.selectionUi ?? "LIST";
  const requiresRecipientStep =
    destinationType === "SERVICE_AREA" &&
    (tippingMode === "TEAM_OR_INDIVIDUAL" ||
      tippingMode === "INDIVIDUAL_ONLY" ||
      tippingMode === "SHIFT_SELECTOR");
  const initialRecipientMode =
    tippingMode === "INDIVIDUAL_ONLY" || (tippingMode === "SHIFT_SELECTOR" && !showTeamOption)
      ? "INDIVIDUAL"
      : "TEAM";
  const [step, setStep] = useState<"recipient" | "amount" | "payment">(
    requiresRecipientStep ? "recipient" : "amount",
  );
  const [selectedRecipientMode, setSelectedRecipientMode] = useState<"TEAM" | "INDIVIDUAL">(
    initialRecipientMode,
  );
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState<string | null>(null);
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

  const surfaceColor = "rgba(255, 251, 246, 0.92)";
  const borderColor = "rgba(97, 77, 61, 0.55)";
  const subtleBorderColor = "rgba(97, 77, 61, 0.24)";
  const mutedTextColor = "rgba(79, 62, 50, 0.72)";
  const surfaceTextColor = "#4b3b2f";
  const surfaceMutedTextColor = "rgba(75, 59, 47, 0.72)";

  const selectedStaffMemberName =
    serviceAreaStaffOptions.find((staffMember) => staffMember.id === selectedStaffMemberId)?.displayName ??
    null;

  const displayTargetName =
    destinationType === "SERVICE_AREA" && selectedRecipientMode === "INDIVIDUAL" && selectedStaffMemberName
      ? selectedStaffMemberName
      : targetName;

  const serviceAreaContextLabel = departmentName ?? displayMode?.replaceAll("_", " ").toLowerCase() ?? "service area";
  const disableContinueFromRecipient =
    selectedRecipientMode === "INDIVIDUAL" &&
    (individualTippingUnavailable || serviceAreaStaffOptions.length === 0 || !selectedStaffMemberId);

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

    if (
      destinationType === "SERVICE_AREA" &&
      selectedRecipientMode === "INDIVIDUAL" &&
      !selectedStaffMemberId
    ) {
      setError("Choose the team member you want to tip.");
      setStep("recipient");
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
        selectedRecipientMode:
          destinationType === "SERVICE_AREA" ? selectedRecipientMode : undefined,
        selectedStaffMemberId:
          destinationType === "SERVICE_AREA" && selectedRecipientMode === "INDIVIDUAL"
            ? selectedStaffMemberId
            : undefined,
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
      {step === "recipient" ? (
        <section className="space-y-5 text-center">
          <div>
            <h2 className="text-[2rem] font-semibold" style={{ color: textColor }}>
              {tippingMode === "SHIFT_SELECTOR" ? "Who served you?" : `Tip ${targetName}`}
            </h2>
            <p className="mt-2 text-base" style={{ color: textColor }}>
              {tippingMode === "TEAM_OR_INDIVIDUAL"
                ? `Choose whether to tip the ${serviceAreaContextLabel} team or an individual.`
                : `Choose the team member for this ${serviceAreaContextLabel} tip.`}
            </p>
          </div>

          {tippingMode === "TEAM_OR_INDIVIDUAL" || (tippingMode === "SHIFT_SELECTOR" && showTeamOption) ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedRecipientMode("TEAM");
                  setError(null);
                }}
                className="rounded-xl border px-4 py-4 text-base font-semibold"
                style={
                  selectedRecipientMode === "TEAM"
                    ? { backgroundColor: buttonColor, color: buttonTextColor, borderColor: buttonColor }
                    : { color: surfaceTextColor, borderColor, backgroundColor: surfaceColor }
                }
              >
                Tip the team
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecipientMode("INDIVIDUAL");
                  setError(null);
                }}
                className="rounded-xl border px-4 py-4 text-base font-semibold"
                style={
                  selectedRecipientMode === "INDIVIDUAL"
                    ? { backgroundColor: buttonColor, color: buttonTextColor, borderColor: buttonColor }
                    : { color: surfaceTextColor, borderColor, backgroundColor: surfaceColor }
                }
              >
                Tip an individual
              </button>
            </div>
          ) : null}

          {selectedRecipientMode === "INDIVIDUAL" ? (
            <div className="grid gap-3">
              {individualTippingUnavailable && individualTippingMessage ? (
                <p className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "#cfaf98", backgroundColor: "#fff4ed", color: "#8b5a3c" }}>
                  {individualTippingMessage}
                </p>
              ) : null}
              {selectionUi === "DROPDOWN" ? (
                <select
                  value={selectedStaffMemberId ?? ""}
                  onChange={(event) => {
                    setSelectedStaffMemberId(event.target.value || null);
                    setError(null);
                  }}
                  className="w-full rounded-xl border px-4 py-4 text-lg font-semibold outline-none"
                  style={{ borderColor, backgroundColor: surfaceColor, color: surfaceTextColor }}
                >
                  <option value="">Select a team member</option>
                  {serviceAreaStaffOptions.map((staffMember) => (
                    <option key={staffMember.id} value={staffMember.id}>
                      {staffMember.roleLabel
                        ? `${staffMember.displayName} · ${staffMember.roleLabel}`
                        : staffMember.displayName}
                    </option>
                  ))}
                </select>
              ) : (
                serviceAreaStaffOptions.map((staffMember) => (
                  <button
                    key={staffMember.id}
                    type="button"
                    onClick={() => {
                      setSelectedStaffMemberId(staffMember.id);
                      setError(null);
                    }}
                    className="w-full rounded-xl border px-5 py-4 text-left text-lg font-semibold transition"
                    style={
                      selectedStaffMemberId === staffMember.id
                        ? { backgroundColor: buttonColor, color: buttonTextColor, borderColor: buttonColor }
                        : { color: surfaceTextColor, borderColor, backgroundColor: surfaceColor }
                    }
                  >
                    <span className="block">{staffMember.displayName}</span>
                    {staffMember.roleLabel ? (
                      <span
                        className="mt-1 block text-sm font-medium"
                        style={{
                          color:
                            selectedStaffMemberId === staffMember.id
                              ? "rgba(255, 255, 255, 0.82)"
                              : surfaceMutedTextColor,
                        }}
                      >
                        {staffMember.roleLabel}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (individualTippingUnavailable) {
                setError(individualTippingMessage ?? "Individual tipping is unavailable right now.");
                return;
              }
              if (selectedRecipientMode === "INDIVIDUAL" && !selectedStaffMemberId) {
                setError("Choose the team member you want to tip.");
                return;
              }
              setStep("amount");
            }}
            className="w-full rounded-xl px-6 py-4 text-lg font-semibold transition"
            style={{ backgroundColor: buttonColor, color: buttonTextColor }}
            disabled={disableContinueFromRecipient}
          >
            Continue
          </button>
        </section>
      ) : step === "amount" ? (
        <section className="space-y-4 text-center">
          <div>
            <h2 className="text-[2rem] font-semibold" style={{ color: textColor }}>
              Tip {displayTargetName}
            </h2>
            <p className="mt-2 text-base" style={{ color: textColor }}>
              {destinationType === "SERVICE_AREA" && selectedRecipientMode === "TEAM"
                ? `Support the ${serviceAreaContextLabel} team.`
                : "Support exceptional services."}
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
                    isSelected ? "border-transparent" : ""
                  }`}
                  style={
                    isSelected
                      ? { backgroundColor: buttonColor, color: buttonTextColor }
                      : { color: surfaceTextColor, borderColor, backgroundColor: surfaceColor }
                  }
                >
                  {formatCurrency(amount, currency)}
                </button>
              );
            })}

            <div className="rounded-xl border px-4 py-3" style={{ borderColor, backgroundColor: surfaceColor }}>
              <label htmlFor="custom-amount" className="sr-only">
                Custom tip amount
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold" style={{ color: surfaceTextColor }}>{currencySymbol}</span>
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
                  className="w-full border-none bg-transparent text-xl font-semibold outline-none"
                  style={{ color: surfaceTextColor }}
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
              className="w-full rounded-xl border px-5 py-4 text-2xl font-semibold"
              style={{ color: surfaceTextColor, borderColor, backgroundColor: surfaceColor }}
            >
              Custom
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          <button
            type="button"
            onClick={() => setStep(requiresRecipientStep ? "recipient" : "amount")}
            className="flex h-11 w-11 items-center justify-center rounded-full border text-xl"
            style={{ backgroundColor: surfaceColor, color: surfaceTextColor, borderColor: subtleBorderColor }}
            aria-label="Go back"
          >
            ←
          </button>

          <div className="text-center">
            <h2 className="text-[2rem] font-semibold" style={{ color: textColor }}>
              Tip {displayTargetName}
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
                    ? ""
                    : ""
                }`}
                    style={{
                      color: isSelected ? surfaceTextColor : surfaceMutedTextColor,
                      borderColor: isSelected ? borderColor : subtleBorderColor,
                      backgroundColor: surfaceColor,
                      boxShadow: isSelected ? "0 8px 20px rgba(93, 67, 46, 0.12)" : "none",
                    }}
                  >
                    {method.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedPaymentMethod === "CARD" ? (
            <div className="space-y-3 rounded-2xl p-4 shadow-[0_8px_24px_rgba(93,67,46,0.08)]" style={{ backgroundColor: surfaceColor }}>
              <label className="block text-left">
                <span className="text-sm font-medium" style={{ color: mutedTextColor }}>Name on card</span>
                <input
                  value={cardName}
                  onChange={(event) => {
                    setCardName(event.target.value);
                    setError(null);
                  }}
                  placeholder="Jane Smith"
                  className="mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none"
                  style={{ borderColor: subtleBorderColor, backgroundColor: surfaceColor, color: surfaceTextColor }}
                />
              </label>

              <label className="block text-left">
                <span className="text-sm font-medium" style={{ color: mutedTextColor }}>Card number</span>
                <input
                  value={cardNumber}
                  onChange={(event) => {
                    setCardNumber(event.target.value);
                    setError(null);
                  }}
                  inputMode="numeric"
                  placeholder="1234 1234 1234 1234"
                  className="mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none"
                  style={{ borderColor: subtleBorderColor, backgroundColor: surfaceColor, color: surfaceTextColor }}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-left">
                  <span className="text-sm font-medium" style={{ color: mutedTextColor }}>Expiry</span>
                  <input
                    value={cardExpiry}
                    onChange={(event) => {
                      setCardExpiry(event.target.value);
                      setError(null);
                    }}
                    inputMode="numeric"
                    placeholder="MM/YY"
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none"
                    style={{ borderColor: subtleBorderColor, backgroundColor: surfaceColor, color: surfaceTextColor }}
                  />
                </label>

                <label className="block text-left">
                  <span className="text-sm font-medium" style={{ color: mutedTextColor }}>CVC</span>
                  <input
                    value={cardCvc}
                    onChange={(event) => {
                      setCardCvc(event.target.value);
                      setError(null);
                    }}
                    inputMode="numeric"
                    placeholder="123"
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none"
                    style={{ borderColor: subtleBorderColor, backgroundColor: surfaceColor, color: surfaceTextColor }}
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
        <p className="mt-5 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "#cfaf98", backgroundColor: "#fff4ed", color: "#8b5a3c" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
