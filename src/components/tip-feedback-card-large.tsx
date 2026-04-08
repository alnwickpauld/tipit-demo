"use client";

import { useState } from "react";

export function TipFeedbackCardLarge({
  tipTransactionId,
  targetLabel,
  textColor,
}: {
  tipTransactionId: string | null;
  targetLabel: string;
  textColor?: string;
}) {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitRating(nextRating: number) {
    setRating(nextRating);

    if (!tipTransactionId) {
      setSubmitted(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const response = await fetch("/api/tip/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipTransactionId,
        rating: nextRating,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to save your rating.");
      setIsSubmitting(false);
      return;
    }

    setSubmitted(true);
    setIsSubmitting(false);
  }

  return (
    <section className="mt-8 text-center">
      <p className="text-[1.65rem] font-semibold" style={{ color: textColor ?? "#111111" }}>
        Review your {targetLabel}
      </p>
      <div className="mt-4 flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={submitted || isSubmitting}
            onClick={() => submitRating(star)}
            aria-label={`Rate ${star} stars`}
            className="flex h-20 w-20 items-center justify-center disabled:cursor-default"
          >
            <span
              aria-hidden
              className={`text-[4.5rem] leading-none transition ${
                star <= rating ? "text-[#a58a72]" : "text-[#d9cec2]"
              }`}
            >
              {"\u2605"}
            </span>
          </button>
        ))}
      </div>
      <div className="mx-auto mt-5 h-px w-full max-w-[16rem] bg-[#bba894]" />
      {submitted ? (
        <p className="mt-4 text-sm text-[#6d5a4d]">Thanks for leaving a rating.</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-[#9f5846]">{error}</p> : null}
    </section>
  );
}
