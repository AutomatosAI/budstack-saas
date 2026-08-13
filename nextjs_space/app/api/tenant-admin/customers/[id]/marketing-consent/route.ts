import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";

/**
 * PATCH /api/tenant-admin/customers/[id]/marketing-consent — US-023.
 *
 * Manually records (an offline opt-in the admin is asserting) or withdraws a
 * customer's marketing consent. `consent: true` stamps users.marketingConsentAt
 * with NOW; `consent: false` clears it. Every call writes an audit row — this
 * is POPIA-relevant state, so the trail of WHO flipped it and WHEN is the
 * point, not decoration.
 *
 * Gated on canEditCustomers (PRD-301 permission gate, not just the coarse
 * TENANT_ADMIN role check the sibling customer routes still use).
 */

const consentToggleSchema = z.object({ consent: z.boolean() }).strict();

// users.id is a Clerk id (`user_…`) for accounts minted via Clerk and a UUID
// for older rows, so parseUuid would 400 on real customers. Pin the charset
// and length instead; the value only ever feeds a parameterised equality.
const customerIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const PATCH = requirePermissionParams(
  "canEditCustomers",
  async (req, { user, tenantId }, params) => {
    try {
      const parsedId = customerIdSchema.safeParse(params.id);
      if (!parsedId.success) throw new ApiError("Invalid customer id.", 400);
      const { consent } = await parseJsonBody(req, consentToggleSchema);

      // Explicit tenantId (defence in depth on top of the lib/db scope layer)
      // and role: PATIENT — the toggle exists for customers, not team members.
      const customer = await prisma.users.findFirst({
        where: { id: parsedId.data, tenantId, role: "PATIENT" },
        select: { id: true, email: true, marketingConsentAt: true },
      });
      if (!customer) throw new ApiError("Customer not found.", 404);

      const marketingConsentAt = consent ? new Date() : null;
      await prisma.users.update({
        where: { id: customer.id },
        data: { marketingConsentAt, updatedAt: new Date() },
      });

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: consent
          ? AUDIT_ACTIONS.CUSTOMER_MARKETING_CONSENT_GRANTED
          : AUDIT_ACTIONS.CUSTOMER_MARKETING_CONSENT_REVOKED,
        entityType: "User",
        entityId: customer.id,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: {
          targetUserEmail: customer.email,
          previousConsentAt: customer.marketingConsentAt?.toISOString() ?? null,
          newConsentAt: marketingConsentAt?.toISOString() ?? null,
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ marketingConsentAt });
    } catch (error) {
      return apiError(error, {
        route: "PATCH /api/tenant-admin/customers/[id]/marketing-consent",
      });
    }
  },
);
