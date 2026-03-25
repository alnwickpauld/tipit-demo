import { redirect } from "next/navigation";
import type { RankingGranularity } from "../../../lib/dashboard-reporting";

type LeaderboardPageProps = {
  searchParams: Promise<{
    venueId?: string;
    granularity?: RankingGranularity;
  }>;
};

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const { venueId, granularity } = await searchParams;
  const params = new URLSearchParams();

  if (venueId) {
    params.set("venueId", venueId);
  }

  if (granularity) {
    params.set("granularity", granularity);
  }

  redirect(
    `/customer-admin/reports/leaderboard${params.toString() ? `?${params.toString()}` : ""}`,
  );
}
