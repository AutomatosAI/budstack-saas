import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { testEmail } = body;

    if (!testEmail) {
      return NextResponse.json(
        { error: "Test email address is required" },
        { status: 400 },
      );
    }

    // Fetch platform config to get SMTP settings
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

    // Decrypt the email server URL
    let smtpUrl: string;
    try {
      smtpUrl = decrypt(config.emailServer);
      if (!smtpUrl) {
        throw new Error("Decryption failed");
      }
    } catch (err) {
      console.error("SMTP decryption error:", err);
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to decrypt SMTP configuration. Please re-enter your SMTP settings.",
        },
        { status: 400 },
      );
    }

    // Create nodemailer transporter
    let transporter;
    try {
      transporter = nodemailer.createTransport(smtpUrl);
    } catch (err: any) {
      console.error("SMTP transporter creation error:", err);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid SMTP URL format: ${err.message}`,
        },
        { status: 400 },
      );
    }

    // Verify SMTP connection
    try {
      console.log("[SMTP Test] Verifying connection...");
      await transporter.verify();
      console.log("[SMTP Test] Connection verified!");
    } catch (err: any) {
      console.error("[SMTP Test] Connection verification failed:", err);
      return NextResponse.json(
        {
          success: false,
          error: `SMTP connection failed: ${err.message}`,
          details: {
            code: err.code,
            command: err.command,
          },
        },
        { status: 400 },
      );
    }

    // Send test email
    const fromAddress = config.emailFrom || "noreply@budstack.to";
    try {
      console.log(`[SMTP Test] Sending test email to ${testEmail}...`);
      const info = await transporter.sendMail({
        from: fromAddress,
        to: testEmail,
        subject: "🧪 BudStack SMTP Test - Connection Successful!",
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                            <h1 style="color: white; margin: 0;">✅ SMTP Test Successful!</h1>
                        </div>
                        <div style="background: #f3f4f6; padding: 30px; border-radius: 0 0 10px 10px;">
                            <p style="color: #374151; font-size: 16px;">
                                Great news! Your SMTP configuration is working correctly.
                            </p>
                            <p style="color: #6b7280; font-size: 14px;">
                                <strong>From:</strong> ${fromAddress}<br>
                                <strong>Sent at:</strong> ${new Date().toISOString()}
                            </p>
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                                This is an automated test email from BudStack Platform
                            </p>
                        </div>
                    </div>
                `,
      });

      console.log(`[SMTP Test] Email sent successfully: ${info.messageId}`);

      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.error("[SMTP Test] Send email failed:", err);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to send test email: ${err.message}`,
          details: {
            code: err.code,
            command: err.command,
            response: err.response,
          },
        },
        { status: 400 },
      );
    }
  } catch (error: any) {
    console.error("Error testing SMTP:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to test SMTP connection",
      },
      { status: 500 },
    );
  }
}
