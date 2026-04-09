import { NextRequest, NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { listSubmissions } from "@/lib/marketplace-review-service";

export const GET = withSuperAdmin(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;

  const submissions = await listSubmissions(status ? { status } : undefined);

  return NextResponse.json({ submissions });
});
