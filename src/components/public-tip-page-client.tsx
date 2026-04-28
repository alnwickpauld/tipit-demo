"use client";

import { useEffect, useState } from "react";

import type { PublicTipPageResponse } from "../lib/public-tip-models";
import { BrandWordmark } from "./brand/brand-wordmark";
import { SandmanWordmark } from "./brand/sandman-wordmark";
import { TipFormClient } from "./tip-form-client";

type PublicTipPageClientProps = {
  slug: string;
};

type PublicTipPageApiResponse = {
  data?: PublicTipPageResponse;
  error?: string;
};

function TipPageSkeleton() {
  return (
    <main className="min-h-screen bg-[#f4ede3] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-sm rounded-[2rem] px-5 py-10">
        <div className="mb-8 flex justify-center">
          <div className="h-[110px] w-[220px] animate-pulse rounded-[1.6rem] bg-[rgba(255,251,246,0.45)]" />
        </div>
        <div className="space-y-4 text-center">
          <div className="mx-auto h-10 w-48 animate-pulse rounded-2xl bg-[rgba(255,251,246,0.6)]" />
          <div className="mx-auto h-5 w-72 animate-pulse rounded-full bg-[rgba(255,251,246,0.48)]" />
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-xl bg-[rgba(255,251,246,0.72)]" />
            <div className="h-16 animate-pulse rounded-xl bg-[rgba(255,251,246,0.72)]" />
            <div className="h-16 animate-pulse rounded-xl bg-[rgba(255,251,246,0.72)]" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function PublicTipPageClient({ slug }: PublicTipPageClientProps) {
  const [data, setData] = useState<PublicTipPageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/tip/${slug}`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            accept: "application/json",
          },
        });

        const payload = (await response.json().catch(() => ({}))) as PublicTipPageApiResponse;

        if (!response.ok || !payload.data) {
          setError(payload.error ?? "Unable to load this tipping page right now.");
          return;
        }

        setData(payload.data);
      } catch (fetchError) {
        if ((fetchError as { name?: string }).name === "AbortError") {
          return;
        }

        setError("Unable to load this tipping page right now.");
      }
    }

    void load();

    return () => controller.abort();
  }, [slug]);

  if (!data && !error) {
    return <TipPageSkeleton />;
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f4ede3] px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-[2rem] bg-[rgba(255,251,246,0.88)] px-6 py-12 text-center shadow-[0_24px_60px_rgba(96,71,49,0.10)]">
          <SandmanWordmark className="text-center" subtitle="Tipit" />
          <h1 className="mt-8 text-3xl font-semibold text-[#45372f]">Tipping page unavailable</h1>
          <p className="mt-3 text-sm text-[#7f6c5f]">
            {error ?? "This QR code could not be resolved."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-6"
      style={{ backgroundColor: data.brandBackgroundColor }}
    >
      <div
        className="mx-auto w-full max-w-sm rounded-[2rem] px-5 py-10"
        style={{
          backgroundColor: data.brandBackgroundColor,
          color: data.brandTextColor,
        }}
      >
        <div className="mb-8 text-center">
          {data.brandLogoImageUrl ? (
            <img
              src={data.brandLogoImageUrl}
              alt={data.brandDisplayName}
              className="mx-auto h-auto w-[220px] max-w-full object-contain"
            />
          ) : (
            <BrandWordmark
              tone="dark"
              title={data.brandDisplayName}
              subtitle={data.venueLocation}
            />
          )}
        </div>
        <TipFormClient
          slug={data.slug}
          currency={data.currency}
          targetName={data.targetName}
          destinationType={data.destinationType}
          serviceAreaJourney={data.serviceAreaJourney}
          textColor={data.brandTextColor}
          buttonColor={data.brandButtonColor}
          buttonTextColor={data.brandButtonTextColor}
          backgroundColor={data.brandBackgroundColor}
        />
      </div>
    </main>
  );
}
