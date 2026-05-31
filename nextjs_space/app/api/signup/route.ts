import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, emailTemplates } from "@/lib/email";
import { getTenantFromRequest } from "@/lib/tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import crypto from "crypto";

// SECURITY (C12): Strict whitelist + length caps on every field. Refusing
// to accept anything outside this schema closes the field-spray and
// 10MB-string DoS surface.
const signupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  dateOfBirth: z.string().max(50).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY (C12): Per-IP rate limit on account creation. 10 accounts
    // per hour per IP is more than any legitimate user needs and slows
    // account-spray attacks that abuse subdomain header manipulation.
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";
    const rateLimitResult = await checkRateLimit(`signup:${ip}`, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
      failMode: "closed",
    });
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = signupSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json(
        {
          error: `Validation error: ${firstError.path.join(".")} — ${firstError.message}`,
        },
        { status: 400 },
      );
    }
    const body = parseResult.data;

    const tenant = await getTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant found" },
        { status: 404 },
      );
    }

    const normalizedEmail = body.email.toLowerCase();

    const existingUser = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 },
      );
    }

    const placeholderPassword = `clerk_managed_${crypto.randomUUID()}`;

    const user = await prisma.users.create({
      data: {
        email: normalizedEmail,
        password: placeholderPassword,
        name: `${body.firstName} ${body.lastName}`,
        role: "PATIENT",
        tenantId: tenant.id,
      },
    });

    const html = await emailTemplates.welcome(
      `${body.firstName} ${body.lastName}`,
      tenant.businessName,
    );
    sendEmail({
      to: normalizedEmail,
      subject: `Welcome to ${tenant.businessName}!`,
      html,
      tenantId: tenant.id,
      templateName: "welcome",
    }).catch((error) => {
      console.error("Failed to send welcome email:", error);
    });

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }
}
