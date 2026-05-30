import { NextResponse } from 'next/server';
import { withTenantAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from '@/lib/audit-log';
import { generateDrGreenSignature } from '@/lib/drgreen-api-client';

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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
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
      automatosAgentId: automatosAgentId ? parseInt(automatosAgentId, 10) : null,
    };

    // Update settings JSON for SMTP
    const currentSettings = (tenant.settings as any) || {};
    const smtpSettings = {
      ...currentSettings.smtp, // keep existing (e.g. if partial update)
      host: smtpHost,
      port: parseInt(smtpPort || "587"),
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
    console.error("Error updating settings detailed:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
});
