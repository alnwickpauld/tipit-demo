import { PublicTipPageClient } from "../../../components/public-tip-page-client";

type TipPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function TipPage({ params }: TipPageProps) {
  const { slug } = await params;
  return <PublicTipPageClient slug={slug} />;
}
