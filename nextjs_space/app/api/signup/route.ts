import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendEmail, emailTemplates } from "@/lib/email";
import { getTenantFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      address,
      city,
      postalCode,
      dateOfBirth,
      acceptTerms,
    } = body;

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!acceptTerms) {
      return NextResponse.json(
        { error: "You must accept the terms and conditions" },
        { status: 400 },
      );
    }

    // Get tenant from request (subdomain)
    const tenant = await getTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json(
        { error: "No active tenant found" },
        { status: 500 },
      );
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        name: `${firstName} ${lastName}`,
        role: "PATIENT",
        tenantId: tenant.id,
      },
    });

    // Send welcome email (don't wait for it)
    // Send welcome email (don't wait for it)
    const html = await emailTemplates.welcome(
      `${firstName} ${lastName}`,
      tenant.businessName,
    );
    sendEmail({
      to: email,
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
