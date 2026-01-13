import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import nodemailer from "nodemailer";

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
    const { testEmail } = body;

    if (!testEmail)
      return NextResponse.json(
        { error: "Test email required" },
        { status: 400 },
      );

    const settings = user.tenants.settings as any;
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

    console.log(`[TenantSMTP] Verifying connection for ${user.tenants.id}...`);
    await transporter.verify();

    const fromAddress = smtp.fromEmail
      ? `"${smtp.fromName || user.tenants.businessName}" <${smtp.fromEmail}>`
      : `"${user.tenants.businessName}" <${smtp.user}>`;

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
  } catch (error: any) {
    console.error("Test SMTP Failed:", error);
    return NextResponse.json(
      { error: error.message || "SMTP Connection Failed" },
      { status: 500 },
    );
  }
}
