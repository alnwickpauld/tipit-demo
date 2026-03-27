import dynamic from "next/dynamic";
import { notFound } from "next/navigation";

import { getPublicTipDestinationBySlug } from "../../../lib/public-tip";

const TipForm = dynamic(
  () => import("../../../components/tip-form").then((module) => module.TipForm),
  {
    ssr: false,
    loading: () => (
      <div className="mt-10 space-y-4 text-center">
        <div className="mx-auto h-10 w-40 animate-pulse rounded-2xl bg-[#d9d9d9]" />
        <div className="mx-auto h-5 w-64 animate-pulse rounded-full bg-[#dfdfdf]" />
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
          <div className="h-16 animate-pulse rounded-xl bg-[#f2f2f2]" />
        </div>
      </div>
    ),
  },
);

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
        <div className="flex justify-center">
          <img
            src={destination.brandLogoImageUrl || "/logo-black.png"}
            alt={destination.venueBrandName}
            className="h-auto w-[220px] max-w-full object-contain"
          />
        </div>

        <TipForm
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
