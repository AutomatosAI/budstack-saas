import { NextResponse } from "next/server";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  try {
    const tenant = await getCurrentTenant();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Error fetching tenant:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant" },
      { status: 500 },
    );
  }
}
