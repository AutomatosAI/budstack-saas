import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import nodemailer from "nodemailer";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const testSmtpSchema = z
  .object({
    testEmail: z.string().min(1).max(320),
  })
  .strict();

export const POST = withSuperAdmin(async (req) => {
  const { testEmail } = await parseJsonBody(req, testSmtpSchema);

  if (!EMAIL_REGEX.test(testEmail)) {
    return apiValidationError(
      "Valid test email address is required",
      "POST /api/super-admin/test-smtp",
    );
  }

  const config = await prisma.platform_config.findUnique({
    where: { id: "config" },
  });

  if (!config?.emailServer) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No SMTP configuration found. Please save your SMTP settings first.",
      },
      { status: 400 },
    );
  }

  let smtpUrl: string;
  try {
    smtpUrl = decrypt(config.emailServer);
    if (!smtpUrl) {
      throw new Error("Decryption failed");
    }
  } catch (err) {
    console.error("[SMTP Test] Decryption error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to decrypt SMTP configuration. Please re-enter your SMTP settings.",
      },
      { status: 400 },
    );
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport(smtpUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[SMTP Test] Transporter creation error:", msg);
    return NextResponse.json(
      {
        success: false,
        error: "Invalid SMTP URL format",
      },
      { status: 400 },
    );
  }

  try {
    await transporter.verify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verification failed";
    console.error("[SMTP Test] Connection verification failed:", msg);
    return NextResponse.json(
      {
        success: false,
        error: `SMTP connection failed: ${msg}`,
      },
      { status: 400 },
    );
  }

  const fromAddress = config.emailFrom || "noreply@budstacks.io";
  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: testEmail,
      subject: "BudStacks SMTP Test — Connection Successful",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">SMTP Test Successful</h1>
          </div>
          <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="color: #374151; font-size: 16px;">
              Your SMTP configuration is working correctly.
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              <strong>From:</strong> ${fromAddress}<br>
              <strong>Sent at:</strong> ${new Date().toISOString()}
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              This is an automated test email from BudStacks Platform
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      messageId: info.messageId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    console.error("[SMTP Test] Send email failed:", msg);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to send test email: ${msg}`,
      },
      { status: 400 },
    );
  }
});
