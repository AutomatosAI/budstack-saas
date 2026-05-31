import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from '@/lib/audit-log';
import { generateDrGreenSignature } from '@/lib/drgreen-api-client';
import { z } from 'zod';
import { apiError } from '@/lib/api-error';
import { parseJsonBody } from '@/lib/validation/body';

const settingsUpdateSchema = z.object({
  customDomain: z.string().max(255).optional().nullable(),
  drGreenApiUrl: z.string().max(2000).optional().nullable(),
  drGreenApiKey: z.string().max(10000).optional().nullable(),
  drGreenSecretKey: z.string().max(10000).optional().nullable(),
  automatosApiKey: z.string().max(2000).optional().nullable(),
  automatosAgentId: z.union([z.string(), z.number()]).optional().nullable(),
  smtpHost: z.string().max(255).optional().nullable(),
  smtpPort: z.union([z.string(), z.number()]).optional().nullable(),
  smtpUser: z.string().max(255).optional().nullable(),
  smtpPassword: z.string().max(1000).optional().nullable(),
  smtpFromEmail: z.string().max(320).optional().nullable(),
  smtpFromName: z.string().max(255).optional().nullable(),
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

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID not found in user metadata" }, { status: 400 });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await parseJsonBody(req, settingsUpdateSchema);
    const {
      customDomain,
      drGreenApiUrl,
      drGreenApiKey,
      drGreenSecretKey,
      automatosApiKey,
      automatosAgentId,
      // SMTP fields
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFromEmail,
      smtpFromName,
    } = body;

    const dataToUpdate: any = {
      customDomain: customDomain || null,
      drGreenApiUrl: drGreenApiUrl || null,
      automatosApiKey: automatosApiKey || null,
      automatosAgentId: automatosAgentId ? parseInt(String(automatosAgentId), 10) : null,
    };

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

    // Only update secret key if a new one is provided (non-empty)
    if (drGreenSecretKey && drGreenSecretKey.trim() !== "") {
      const normalizedSecret = normalizeDrGreenKey(drGreenSecretKey);
      // Validate format by dry-run signing — prevents garbage being stored
      try {
        generateDrGreenSignature("validation_test", normalizedSecret);
      } catch {
        return NextResponse.json(
          {
            error: "Secret key format invalid — could not produce a signature. Please re-paste the Dr Green secret key, ensuring nothing is truncated and no extra characters snuck in.",
          },
          { status: 400 },
        );
      }
      console.log("Encrypting new secret key...");
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

    console.log('Updating tenant with data:', {
      ...dataToUpdate,
      drGreenSecretKey: dataToUpdate.drGreenSecretKey ? '***' : undefined,
      drGreenApiKey: dataToUpdate.drGreenApiKey ? '***' : undefined,
    });

    // Update tenant
    await prisma.tenants.update({
      where: { id: tenant.id },
      data: dataToUpdate,
    });

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

    console.log('Settings updated successfully');
    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/settings",
      safeMessage: "Failed to update settings",
    });
  }
}
