import { NextResponse } from "next/server";

import { logger, toLoggableError } from "../../../../lib/logger";
import { getPublicTipDestinationBySlug } from "../../../../lib/public-tip";
import { toPublicTipPageResponse } from "../../../../lib/public-tip-models";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const destination = await getPublicTipDestinationBySlug(slug);

    if (!destination) {
      return NextResponse.json({ error: "QR destination not found." }, { status: 404 });
    }

    return NextResponse.json(
      { data: toPublicTipPageResponse(destination) },
      {
        headers: {
          "cache-control": "public, max-age=15, stale-while-revalidate=45",
        },
      },
    );
  } catch (error) {
    logger.error("Failed to resolve public tip page data", {
      error: toLoggableError(error),
    });

    return NextResponse.json(
      { error: "Unable to load this tipping page right now. Please try again." },
      { status: 500 },
    );
  }
}
