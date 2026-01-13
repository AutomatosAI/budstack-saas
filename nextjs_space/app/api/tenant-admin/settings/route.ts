import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      customDomain,
      drGreenApiUrl,
      drGreenApiKey,
      drGreenSecretKey,
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
    };

    // Update settings JSON for SMTP
    const currentSettings = (user.tenants.settings as any) || {};
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
      console.log("Encrypting new secret key...");
      try {
        dataToUpdate.drGreenSecretKey = encrypt(drGreenSecretKey);
      } catch (e) {
        console.error("Encryption failed:", e);
        throw e;
      }
    }

    if (drGreenApiKey && drGreenApiKey.trim() !== '') {
      try {
        dataToUpdate.drGreenApiKey = encrypt(drGreenApiKey);
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
      where: { id: user.tenants.id },
      data: dataToUpdate,
    });

    const { ipAddress, userAgent } = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'Tenant',
      entityId: user.tenants.id,
      userId: session.user.id,
      userEmail: session.user.email,
      tenantId: user.tenants.id,
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
}
