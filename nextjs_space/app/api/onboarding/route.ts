import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail, emailTemplates } from "@/lib/email";
import crypto from "crypto";

const TEMPLATE_PRESETS = {
  modern: {
    primaryColor: "#10b981",
    secondaryColor: "#059669",
    accentColor: "#34d399",
    fontFamily: "Inter",
  },
  medical: {
    primaryColor: "#3b82f6",
    secondaryColor: "#2563eb",
    accentColor: "#60a5fa",
    fontFamily: "Inter",
  },
  natural: {
    primaryColor: "#84cc16",
    secondaryColor: "#65a30d",
    accentColor: "#a3e635",
    fontFamily: "Inter",
  },
  premium: {
    primaryColor: "#8b5cf6",
    secondaryColor: "#7c3aed",
    accentColor: "#a78bfa",
    fontFamily: "Inter",
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      businessName,
      email,
      password,
      subdomain,
      nftTokenId,
      contactInfo,
      countryCode,
      templateId,
    } = body;

    // Validation
    if (
      !businessName ||
      !email ||
      !password ||
      !subdomain ||
      !nftTokenId ||
      !countryCode
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 1. Check for duplicates in LOCAL DB first (faster fail)
    const existingTenant = await prisma.tenants.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "Subdomain already taken" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.users.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 },
      );
    }

    // 2. Create Clerk User
    let clerkUser;
    try {
      const client = await clerkClient();
      clerkUser = await client.users.createUser({
        emailAddress: [email],
        password,
        firstName: businessName, // Using business name as first name for now
        // lastName: "", 
        publicMetadata: {
          role: "TENANT_ADMIN",
        },
      });
    } catch (error: any) {
      console.error("Clerk User Creation Error:", error);
      if (error.errors?.[0]?.code === "form_identifier_exists") {
        return NextResponse.json(
          { error: "Email is already registered in our system. Please login instead." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Authentication Error: ${error.errors?.[0]?.message || "Failed to create user"}` },
        { status: 400 }
      );
    }

    // 3. Create Clerk Organization
    let clerkOrg;
    try {
      const client = await clerkClient();
      clerkOrg = await client.organizations.createOrganization({
        name: businessName,
        slug: subdomain, // Using subdomain as the org slug for consistency
        createdBy: clerkUser.id,
        publicMetadata: {
          nftTokenId,
          countryCode
        }
      });
    } catch (error: any) {
      console.error("Clerk Org Creation Error:", error);
      // Clean up user if org creation fails? 
      // Ideally yes, but for now let's just error out. 
      // Deleting the user requires the ID.
      const client = await clerkClient();
      await client.users.deleteUser(clerkUser.id);

      if (error.errors?.[0]?.code === "form_identifier_exists") { // Only applies to user, but slug collision is distinct
        return NextResponse.json(
          { error: "Organization URL/Slug is already taken." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Organization Error: ${error.errors?.[0]?.message || "Failed to create organization"}` },
        { status: 400 }
      );
    }

    // 4. Update Clerk User Metadata with new Org ID (for easier lookup later)
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        role: "TENANT_ADMIN",
        tenantId: clerkOrg.id // Mapping Clerk Org ID to our concept of Tenant ID
      }
    });

    // 5. Create Local Tenant (mirroring Clerk Org)
    // Get actual template from database or fallback to healingbuds
    let dbTemplate = await prisma.templates.findFirst({
      where: { slug: templateId || "healingbuds" },
    });

    if (!dbTemplate) {
      dbTemplate = await prisma.templates.findFirst({
        where: { slug: "healingbuds" },
      });
    }

    if (!dbTemplate) {
      // Safety fallback creation
      dbTemplate = await prisma.templates.create({
        data: {
          name: "HealingBuds Default",
          slug: "healingbuds",
          description: "Default medical cannabis template",
          category: "medical",
          version: "1.0.0",
          author: "BudStack",
          isActive: true,
        },
      });
    }

    const template =
      TEMPLATE_PRESETS[templateId as keyof typeof TEMPLATE_PRESETS] ||
      TEMPLATE_PRESETS.modern;

    // We use Clerk Org ID as our Tenant ID to keep them in sync? 
    // Wait, the Clerk Org ID is like `org_2...`. Our DB uses UUIDs.
    // We can't easily force Clerk IDs into UUID columns if our schema enforces UUID.
    // Let's check schema.

    // Assuming schema is UUID based on previous code `crypto.randomUUID()`.
    // So we will generate a UUID for our local Tenant, and store the Clerk Org ID in `settings` or a new column?
    // Or we just rely on the link.
    // For now, let's generate a UUID for local tenant, but usually we want to map them.
    // If the schema `tenants.id` is a UUID, we can't use `org_...`.
    // Solution: Keep local UUID, but store `clerkOrgId` in `tenants` table if possible, or matches by subdomain?
    // The previous code verified subdomain uniqueness.

    const tenantId = crypto.randomUUID();

    const tenant = await prisma.tenants.create({
      data: {
        id: tenantId,
        businessName,
        subdomain,
        nftTokenId,
        countryCode: countryCode || "PT",
        isActive: true, // Auto-activate for now since we have Clerk auth? Or keep false? User said "register the NEW Org".
        templateId: dbTemplate.id,
        updatedAt: new Date(),
        settings: {
          contactInfo,
          templatePreset: templateId || "modern",
          clerkOrgId: clerkOrg.id // Store Clerk Org ID in settings
        },
      },
    });

    // Create tenant branding
    await prisma.tenant_branding.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        accentColor: template.accentColor,
        fontFamily: template.fontFamily,
        updatedAt: new Date(),
      },
    });

    // 6. Create Local User (mirroring Clerk User)
    // Upsert to handle potential webhook race condition
    await prisma.users.upsert({
      where: { email },
      update: {
        name: businessName,
        role: "TENANT_ADMIN",
        tenantId: tenant.id,
        updatedAt: new Date(),
        // Store Clerk User ID if possible?
        // We lack a `clerkId` column in standard schema usually, but let's check.
        // If not, we rely on email. 
      },
      create: {
        id: crypto.randomUUID(), // Local UUID
        email,
        password: "CLERK_MANAGED_ACCOUNT",
        name: businessName,
        role: "TENANT_ADMIN",
        tenantId: tenant.id,
        updatedAt: new Date(),
      }
    });

    // 7. Send Welcome Email
    const html = await emailTemplates.tenantWelcome(
      businessName,
      businessName,
      subdomain,
    );
    sendEmail({
      to: email,
      subject: "Welcome to BudStack - Your Store is Ready!",
      html,
      tenantId: tenant.id,
      templateName: "tenantWelcome",
    }).catch((error) => {
      console.error("Failed to send tenant welcome email:", error);
    });

    return NextResponse.json({
      message: "Application submitted successfully",
      tenantId: tenant.id,
      clerkUserId: clerkUser.id,
      clerkOrgId: clerkOrg.id
    });

  } catch (error: any) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
