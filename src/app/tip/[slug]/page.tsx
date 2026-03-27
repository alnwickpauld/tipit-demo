import { notFound } from "next/navigation";

import { TipFormClient } from "../../../components/tip-form-client";
import { getPublicTipDestinationBySlug } from "../../../lib/public-tip";

type TipPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function TipPage({ params }: TipPageProps) {
  const { slug } = await params;
  const destination = await getPublicTipDestinationBySlug(slug);

  if (!destination) {
    notFound();
  }

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-6"
      style={{ backgroundColor: destination.brandBackgroundColor }}
    >
      <div
        className="mx-auto w-full max-w-sm rounded-[2rem] px-5 py-10"
        style={{
          backgroundColor: destination.brandBackgroundColor,
          color: destination.brandTextColor,
        }}
      >
        <div className="mb-8 text-center">
          <img
            src={destination.brandLogoImageUrl || "/logo-black.png"}
            alt={destination.venueBrandName}
            className="mx-auto h-auto w-[220px] max-w-full object-contain"
          />
        </div>
        <TipFormClient
          slug={destination.slug}
          currency={destination.currency}
          targetName={destination.targetName}
          textColor={destination.brandTextColor}
          buttonColor={destination.brandButtonColor}
          buttonTextColor={destination.brandButtonTextColor}
          backgroundColor={destination.brandBackgroundColor}
        />
      </div>
    </main>
  );
}
