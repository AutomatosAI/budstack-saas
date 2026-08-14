import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/permissions/require-permission";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { FEATURES, getTenantFeatures, hasFeature } from "@/lib/entitlements/features";
import {
  buildTenantDomains,
  partnerKey,
  provisionTenant,
} from "@/lib/integrations/automatos-provision";

/**
 * US-008: one-click Automatos provisioning. Mints workspace + origin-locked
 * ak_pub key on the orchestrator (idempotent; never rotates an existing key —
 * PR automatos-ai#627), stores the key and flips the chatbot toggle on.
 * Manual key entry in settings remains as an override.
 */
export const POST = requirePermission("canEditSettings", async (req, { user, tenantId }) => {
  try {
    if (!hasFeature(getTenantFeatures({ id: tenantId }), FEATURES.AUTOMATOS_CHATBOT)) {
      return NextResponse.json(
        { error: "The storefront chatbot is a Pro feature. Upgrade to enable it." },
        { status: 403 },
      );
    }

    if (!partnerKey()) {
      return NextResponse.json(
        { error: "Automatic provisioning is not configured on this platform yet." },
        { status: 503 },
      );
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        businessName: true,
        subdomain: true,
        customDomain: true,
        automatosApiKey: true,
      },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const domains = buildTenantDomains(tenant.subdomain, tenant.customDomain);
    const result = await provisionTenant({
      tenantId: tenant.id,
      businessName: tenant.businessName,
      domains,
    });

    // key_minted=false means the orchestrator kept the existing key
    // (reuse-not-rotate) — only overwrite ours when a fresh one was minted.
    const dataToUpdate: Record<string, unknown> = {
      automatosChatbotEnabled: true,
    };
    if (result.key_minted && result.api_key) {
      dataToUpdate.automatosApiKey = result.api_key;
    }
    await prisma.tenants.update({ where: { id: tenantId }, data: dataToUpdate });

    const { ipAddress, userAgent } = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: "Tenant",
      entityId: tenantId,
      userId: user.id,
      userEmail: user.email,
      tenantId,
      metadata: {
        source: "automatos-provision",
        keyMinted: result.key_minted,
        domains: domains.length,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      provisioned: true,
      keyMinted: result.key_minted,
      keyAlreadyHeld: !result.key_minted && Boolean(tenant.automatosApiKey),
      domains,
    });
  } catch (error) {
    console.error("Automatos provisioning failed:", error);
    return apiError(error, {
      route: "POST /api/tenant-admin/automatos/provision",
      safeMessage: "Automatic provisioning failed — nothing was changed.",
    });
  }
});
