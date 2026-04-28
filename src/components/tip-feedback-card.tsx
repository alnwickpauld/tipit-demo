"use client";

import { useState } from "react";

export function TipFeedbackCard({
  tipTransactionId,
  targetLabel,
}: {
  tipTransactionId: string | null;
  targetLabel: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitFeedback(nextRating = rating) {
    const trimmedComment = comment.trim();
    setRating(nextRating);

    if (nextRating < 1 && !trimmedComment) {
      setError("Add a rating, a comment, or both.");
      return;
    }

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
        rating: nextRating > 0 ? nextRating : undefined,
        comment: trimmedComment || undefined,
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
      <p className="text-[1.65rem] font-semibold text-[#111111]">Review your {targetLabel}</p>
      <div className="mt-4 flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={submitted || isSubmitting}
            onClick={() => {
              setRating(star);
              setError(null);
            }}
            aria-label={`Rate ${star} stars`}
            className={`relative flex h-20 w-20 items-center justify-center transition ${
              star <= rating ? "text-[#c7b7a5]" : "text-[#d8d8d8]"
            } disabled:cursor-default`}
          >
            <span
              aria-hidden
              className={`absolute inset-0 flex items-center justify-center text-[4.5rem] leading-none ${
                star <= rating ? "text-[#c7b7a5]" : "text-[#d8d8d8]"
              }`}
            >
              {"\u2605"}
            </span>
            ★
          </button>
        ))}
      </div>
      <label className="mx-auto mt-5 block max-w-md text-left">
        <span className="text-sm font-medium text-[#4f4f4f]">Optional comment</span>
        <textarea
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            setError(null);
          }}
          disabled={submitted || isSubmitting}
          rows={3}
          maxLength={500}
          placeholder="Tell us a little more."
          className="mt-2 w-full rounded-2xl border border-[#cfc4b6] bg-white px-4 py-3 text-sm text-[#3f3f3f] outline-none placeholder:text-[#9d9d9d] disabled:opacity-70"
        />
      </label>
      <button
        type="button"
        onClick={() => void submitFeedback()}
        disabled={submitted || isSubmitting || (rating < 1 && comment.trim().length === 0)}
        className="mt-5 w-full rounded-xl bg-[#c7b7a5] px-6 py-4 text-base font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending feedback..." : "Send feedback"}
      </button>
      <div className="mx-auto mt-5 h-px w-full max-w-[16rem] bg-[#bcbcbc]" />
      {submitted ? (
        <p className="mt-4 text-sm text-[#4f4f4f]">Thanks for sharing your feedback.</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-[#9f2d20]">{error}</p> : null}
    </section>
  );
}
