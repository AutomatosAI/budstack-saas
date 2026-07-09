import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions/require-permission";
import { listRolesWithPermissions } from "@/lib/team/roles";

export const GET = requirePermission("canEditSettings", async () => {
  try {
    const roles = await listRolesWithPermissions();
    return NextResponse.json({ roles });
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/team/roles" });
  }
});
