import { redirect } from "next/navigation";

type DashboardRedirectPageProps = {
  searchParams: Promise<{
    venueId?: string;
  }>;
};

export default async function DashboardRedirectPage({
  searchParams,
}: DashboardRedirectPageProps) {
  const { venueId } = await searchParams;
  const params = new URLSearchParams();

  if (venueId) {
    params.set("venueId", venueId);
  }

  redirect(`/customer-admin${params.toString() ? `?${params.toString()}` : ""}`);
}
