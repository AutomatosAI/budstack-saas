import { NextResponse } from 'next/server';
import { withTenantAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/security/encryption';
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from '@/lib/audit-log';
import { generateDrGreenSignature } from '@/lib/drgreen/drgreen-api-client';
import { z } from 'zod';
import { apiError, apiValidationError } from '@/lib/api-error';
import { parseJsonBody } from '@/lib/validation/body';
import { SA_TENANT_COUNTRY_CODE } from '@/lib/verification-mode';
import { logger } from '@/lib/logger';
import { getTenantFeatures } from '@/lib/entitlements/features';
import { chatbotEnableForbidden } from '@/lib/entitlements/toggle-guards';

const settingsUpdateSchema = z.object({
  customDomain: z.string().max(255).optional().nullable(),
  drGreenApiUrl: z.string().max(2000).optional().nullable(),
  drGreenApiKey: z.string().max(10000).optional().nullable(),
  drGreenSecretKey: z.string().max(10000).optional().nullable(),
  automatosApiKey: z.string().max(2000).optional().nullable(),
  automatosAgentId: z.union([z.string(), z.number()]).optional().nullable(),
  automatosChatbotEnabled: z.boolean().optional(),
  smtpHost: z.string().max(255).optional().nullable(),
  smtpPort: z.union([z.string(), z.number()]).optional().nullable(),
  smtpUser: z.string().max(255).optional().nullable(),
  smtpPassword: z.string().max(1000).optional().nullable(),
  smtpFromEmail: z.string().max(320).optional().nullable(),
  smtpFromName: z.string().max(255).optional().nullable(),
  verificationMode: z.enum(["KYC", "ID_UPLOAD"]).optional(),
});

/**
 * Normalize Dr Green keys to the stored format the signer expects:
 * base64(PEM text). If the user pasted raw PEM (starts with -----BEGIN),
 * base64-encode it. If they pasted the base64 blob Dr Green hands out
 * (starts with LS0tLS...), leave it alone.
 */
function normalizeDrGreenKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("-----BEGIN")) {
    return Buffer.from(trimmed, "utf-8").toString("base64");
  }
  return trimmed;
}

export const POST = withTenantAuth(async (req, { user, tenantId }) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "POST /api/tenant-admin/settings",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    const body = await parseJsonBody(req, settingsUpdateSchema);
    const {
      customDomain,
      drGreenApiUrl,
      drGreenApiKey,
      drGreenSecretKey,
      automatosApiKey,
      automatosAgentId,
      automatosChatbotEnabled,
      // SMTP fields
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFromEmail,
      smtpFromName,
    } = body;

    // US-005: turning the chatbot ON is entitlement-gated server-side —
    // the client toggle is presentation, this is the enforcement.
    if (
      chatbotEnableForbidden(
        automatosChatbotEnabled,
        tenant.automatosChatbotEnabled,
        getTenantFeatures({ id: tenantId }),
      )
    ) {
      return NextResponse.json(
        { error: "The storefront chatbot is a Pro feature. Upgrade to enable it." },
        { status: 403 },
      );
    }

    const dataToUpdate: any = {
      customDomain: customDomain || null,
      drGreenApiUrl: drGreenApiUrl || null,
      automatosApiKey: automatosApiKey || null,
      automatosAgentId: automatosAgentId ? parseInt(String(automatosAgentId), 10) : null,
    };
    if (typeof automatosChatbotEnabled === "boolean") {
      dataToUpdate.automatosChatbotEnabled = automatosChatbotEnabled;
    }

    // Update settings JSON for SMTP
    const currentSettings = (tenant.settings as any) || {};
    const smtpSettings = {
      ...currentSettings.smtp, // keep existing (e.g. if partial update)
      host: smtpHost,
      port: parseInt(String(smtpPort || "587"), 10),
      user: smtpUser,
      fromEmail: smtpFromEmail,
      fromName: smtpFromName,
    };

    // Handle Password Encryption
    if (smtpPassword && smtpPassword.trim() !== "") {
      try {
        smtpSettings.password = encrypt(smtpPassword);
      } catch (e) {
        console.error("SMTP Password Encryption failed:", e);
      }
    }

    // Merge into settings
    dataToUpdate.settings = {
      ...currentSettings,
      smtp: smtpSettings,
    };

    // Verification mode (SA ID-upload vs KYC) — only honoured for ZA tenants,
    // so the ID-upload path can never be enabled outside South Africa.
    if (
      body.verificationMode &&
      (tenant.countryCode || "").toUpperCase() === SA_TENANT_COUNTRY_CODE
    ) {
      dataToUpdate.settings.verificationMode = body.verificationMode;
    }

    // Only update secret key if a new one is provided (non-empty)
    if (drGreenSecretKey && drGreenSecretKey.trim() !== "") {
      const normalizedSecret = normalizeDrGreenKey(drGreenSecretKey);
      // Validate format by dry-run signing — prevents garbage being stored
      try {
        generateDrGreenSignature("validation_test", normalizedSecret);
      } catch {
        return apiValidationError(
          "Secret key format invalid — could not produce a signature. Please re-paste the Dr Green secret key, ensuring nothing is truncated and no extra characters snuck in.",
          "POST /api/tenant-admin/settings",
        );
      }
      logger.info("Encrypting new secret key...");
      try {
        dataToUpdate.drGreenSecretKey = encrypt(normalizedSecret);
      } catch (e) {
        console.error("Encryption failed:", e);
        throw e;
      }
    }

    if (drGreenApiKey && drGreenApiKey.trim() !== '') {
      const normalizedApiKey = normalizeDrGreenKey(drGreenApiKey);
      try {
        dataToUpdate.drGreenApiKey = encrypt(normalizedApiKey);
      } catch (e) {
        console.error('Encryption failed:', e);
        throw e;
      }
    }

    logger.info('Updating tenant with data', {
      ...dataToUpdate,
      drGreenSecretKey: dataToUpdate.drGreenSecretKey ? '***' : undefined,
      drGreenApiKey: dataToUpdate.drGreenApiKey ? '***' : undefined,
    });

    // Update tenant
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: dataToUpdate,
    });

    // US-009: the Automatos public key is origin-allowlisted, so a custom-
    // domain change must follow to the orchestrator or the widget 403s on the
    // new host. Fire-and-forget — a sync failure is logged, never blocks the
    // settings save (re-provisioning later heals it: idempotent, no rotation).
    const newCustomDomain = (dataToUpdate.customDomain ?? null) as string | null;
    if (tenant.automatosApiKey && newCustomDomain !== tenant.customDomain) {
      const { buildTenantDomains, partnerKey, syncTenantDomains } = await import(
        "@/lib/integrations/automatos-provision"
      );
      if (partnerKey()) {
        void syncTenantDomains({
          tenantId: tenant.id,
          domains: buildTenantDomains(tenant.subdomain, newCustomDomain),
        }).catch((e: unknown) => {
          logger.warn("Automatos domains re-sync failed (non-blocking)", {
            tenantId: tenant.id,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      }
    }

    const { ipAddress, userAgent } = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'Tenant',
      entityId: tenant.id,
      userId: user.id,
      userEmail: user.email,
      tenantId: tenant.id,
      metadata: {
        updatedFields: Object.keys(dataToUpdate).filter((key) => key !== 'settings'),
        hasSmtpUpdate: !!dataToUpdate.settings?.smtp,
      },
      ipAddress,
      userAgent,
    });

    logger.info('Settings updated successfully');
    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/settings",
      safeMessage: "Failed to update settings",
    });
  }
});
