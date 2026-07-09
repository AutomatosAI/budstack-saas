import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { roleUpdateSchema } from "@/lib/team/schemas";
import { updateRolePermissions } from "@/lib/team/roles";

export const PUT = requirePermissionParams(
  "canEditSettings",
  async (req, { user, tenantId }, params) => {
    try {
      const { permissions } = await parseJsonBody(req, roleUpdateSchema);
      await updateRolePermissions(tenantId, params.role, permissions);

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEAM.ROLE_PERMISSIONS_UPDATED,
        entityType: "Role",
        entityId: params.role,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: { role: params.role, permissions },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return apiError(error, { route: "PUT /api/tenant-admin/team/roles/[role]" });
    }
  },
);
