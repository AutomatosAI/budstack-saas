import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/security/encryption";
import { z } from "zod";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { logger } from "@/lib/logger";
import nodemailer from "nodemailer";

const testSmtpSchema = z
  .object({
    testEmail: z.string().min(1).max(320),
  })
  .strict();

// SECURITY (H_e3): SMTP errors leak sensitive details — auth responses,
// hostnames, response codes that aid attackers in fingerprinting. Map
// known nodemailer error codes to non-actionable client messages while
// keeping the full error in the server log via apiError().
function mapSmtpErrorToSafeMessage(err: unknown): string {
  if (!(err instanceof Error)) return "SMTP connection failed";
  const code = (err as { code?: string }).code;
  switch (code) {
    case "EAUTH":
      return "SMTP authentication failed — check username/password";
    case "ECONNECTION":
    case "ECONNREFUSED":
      return "SMTP server unreachable — check host and port";
    case "ETIMEDOUT":
    case "ESOCKET":
      return "SMTP connection timed out";
    case "ENVELOPE":
      return "SMTP rejected the recipient address";
    default:
      return "SMTP connection failed";
  }
}

export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return apiError(new Error("Tenant not found"), {
        route: "POST /api/tenant-admin/settings/test-smtp",
        status: 404,
        safeMessage: "Tenant not found",
      });
    }

    const { testEmail } = await parseJsonBody(req, testSmtpSchema);

    const settings = tenant.settings as any;
    const smtp = settings?.smtp;

    if (!smtp || !smtp.host || !smtp.user || !smtp.password) {
      return apiValidationError(
        "SMTP Settings not fully configured. Please save settings first.",
        "POST /api/tenant-admin/settings/test-smtp",
      );
    }

    let password;
    try {
      password = decrypt(smtp.password);
    } catch (e) {
      return apiValidationError(
        "Failed to decrypt SMTP password. Try saving settings again.",
        "POST /api/tenant-admin/settings/test-smtp",
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: smtp.secure || false,
      auth: {
        user: smtp.user,
        pass: password,
      },
    });

    logger.info(`[TenantSMTP] Verifying connection for ${tenantId}...`);
    await transporter.verify();

    const fromAddress = smtp.fromEmail
      ? `"${smtp.fromName || tenant.businessName}" <${smtp.fromEmail}>`
      : `"${tenant.businessName}" <${smtp.user}>`;

    await transporter.sendMail({
      from: fromAddress,
      to: testEmail,
      subject: "🧪 SMTP Test - Configuration Successful",
      html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #059669;">✅ Test Email Successful</h2>
                    <p>Your custom SMTP settings are correctly configured.</p>
                    <hr/>
                    <p style="font-size: 12px; color: #666;">
                        Sent from: ${fromAddress}<br/>
                        Host: ${smtp.host}
                    </p>
                </div>
            `,
    });

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully.",
    });
  } catch (error) {
    return apiError(error, {
      route: "tenant-admin.settings.test-smtp",
      status: 500,
      safeMessage: mapSmtpErrorToSafeMessage(error),
    });
  }
});
