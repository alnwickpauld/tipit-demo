import { NextResponse } from "next/server";

import { logger, toLoggableError } from "../../../../../lib/logger";
import { getPublicTipStaffSelectionBySlug } from "../../../../../lib/public-tip-staff-options";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const response = await getPublicTipStaffSelectionBySlug(slug);

    if (!response) {
      return NextResponse.json({ error: "QR destination not found." }, { status: 404 });
    }

    return NextResponse.json({ data: response });
  } catch (error) {
    logger.error("Failed to resolve public tip staff selection options", {
      error: toLoggableError(error),
    });

    return NextResponse.json(
      { error: "Unable to load team members right now. Please try again." },
      { status: 500 },
    );
  }
}
