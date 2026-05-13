import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { apiError } from "@/lib/api-error";
import nodemailer from "nodemailer";

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

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;
    const role = (user.publicMetadata.role as string) || "";

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!localUser?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
    const { testEmail } = body;

    if (!testEmail)
      return NextResponse.json(
        { error: "Test email required" },
        { status: 400 },
      );

    const settings = localUser.tenants.settings as any;
    const smtp = settings?.smtp;

    if (!smtp || !smtp.host || !smtp.user || !smtp.password) {
      return NextResponse.json(
        {
          error:
            "SMTP Settings not fully configured. Please save settings first.",
        },
        { status: 400 },
      );
    }

    let password;
    try {
      password = decrypt(smtp.password);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Failed to decrypt SMTP password. Try saving settings again.",
        },
        { status: 400 },
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

    console.log(`[TenantSMTP] Verifying connection for ${localUser.tenants.id}...`);
    await transporter.verify();

    const fromAddress = smtp.fromEmail
      ? `"${smtp.fromName || localUser.tenants.businessName}" <${smtp.fromEmail}>`
      : `"${localUser.tenants.businessName}" <${smtp.user}>`;

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
}
