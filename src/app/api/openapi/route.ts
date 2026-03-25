import { NextResponse } from "next/server";

import { buildOpenApiDocument } from "../../../server/api-reference";

export async function GET() {
  return NextResponse.json(buildOpenApiDocument());
}
