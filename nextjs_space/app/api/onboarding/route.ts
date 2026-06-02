import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail, emailTemplates } from "@/lib/email/email";
import { copyS3Directory, getJsonFromS3 } from "@/lib/storage/s3";
import crypto from "crypto";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isReservedSubdomain, isValidSubdomain } from "@/lib/reserved-subdomains";
import { createAuditLog } from "@/lib/audit-log";
import {
  DPA_ACCEPTED_AUDIT_ACTION,
  dpaAcceptanceSchema,
} from "@/lib/gdpr/dpa";
import { apiError, apiValidationError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const onboardingSchema = z
  .object({
    businessName: z.string().min(1).max(100),
    email: z.string().email().max(254),
    password: z.string().min(8).max(128),
    subdomain: z.string().min(2).max(30).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Invalid subdomain format"),
    nftTokenId: z.string().min(1).max(200),
    contactInfo: z.union([
      z.string().max(1000),
      z.object({
        phone: z.string().max(20).optional(),
        address: z.string().max(500).optional(),
      }),
    ]).optional(),
    countryCode: z.string().length(2).regex(/^[A-Z]{2}$/),
    templateId: z.string().max(100).optional(),
  })
  // PRD-213 AC-2a: a current DPA acceptance is mandatory at onboarding.
  .merge(dpaAcceptanceSchema);

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
    const rawBody = await req.json();

    // Rate limit by IP — public endpoint that creates orgs + users
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = await checkRateLimit(`onboarding:${ip}`, { maxRequests: 3, windowMs: 60000, failMode: 'closed' });
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Zod validation
    const parseResult = onboardingSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return apiValidationError(
        `Validation error: ${firstError.path.join('.')} — ${firstError.message}`,
        "POST /api/onboarding",
      );
    }

    const {
      businessName,
      email,
      password,
      subdomain,
      nftTokenId,
      contactInfo,
      countryCode,
      templateId,
      dpaVersion,
      dpaAcceptedAt,
    } = parseResult.data;

    // Subdomain format validation
    const normalizedSubdomain = subdomain.toLowerCase().trim();
    if (!isValidSubdomain(normalizedSubdomain)) {
      return apiValidationError(
        "Subdomain must be 2-30 characters, lowercase alphanumeric and hyphens only",
        "POST /api/onboarding",
      );
    }
    if (isReservedSubdomain(normalizedSubdomain)) {
      return apiValidationError(
        "This subdomain is reserved. Please choose another.",
        "POST /api/onboarding",
      );
    }

    // 1. Check for duplicates in LOCAL DB first (faster fail)
    const existingTenant = await prisma.tenants.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      return apiValidationError("Subdomain already taken", "POST /api/onboarding");
    }

    const existingUser = await prisma.users.findFirst({
      where: { email },
    });

    if (existingUser) {
      return apiValidationError("Email already registered", "POST /api/onboarding");
    }

    // 2. Create Clerk User
    const client = await clerkClient();
    let clerkUser;
    try {
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
        return apiValidationError(
          "Email is already registered in our system. Please login instead.",
          "POST /api/onboarding",
        );
      }
      return apiValidationError(
        `Authentication Error: ${error.errors?.[0]?.message || "Failed to create user"}`,
        "POST /api/onboarding",
      );
    }

    // 3. Create Clerk Organization
    let clerkOrg;
    try {
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
      await client.users.deleteUser(clerkUser.id);

      if (error.errors?.[0]?.code === "form_identifier_exists") { // Only applies to user, but slug collision is distinct
        return apiValidationError(
          "Organization URL/Slug is already taken.",
          "POST /api/onboarding",
        );
      }
      return apiValidationError(
        `Organization Error: ${error.errors?.[0]?.message || "Failed to create organization"}`,
        "POST /api/onboarding",
      );
    }

    // 4. Update Clerk User Metadata with new Org ID (for easier lookup later)
    await client.users.updateUserMetadata(clerkUser.id, {
      publicMetadata: {
        role: "TENANT_ADMIN",
        tenantId: clerkOrg.id // Mapping Clerk Org ID to our concept of Tenant ID
      }
    });

    // 5. Create Local DB Records (tenant, branding, template, user)
    // Wrapped in try/catch to rollback Clerk records if DB fails
    try {
      // Get actual template from database — templateId could be a slug OR a UUID
      let dbTemplate = templateId
        ? await prisma.templates.findFirst({
            where: {
              OR: [
                { slug: templateId },
                { id: templateId },
              ],
            },
          })
        : null;

      if (!dbTemplate) {
        // Try platform default template if configured, otherwise grab any active template
        const defaultSlug = process.env.PLATFORM_DEFAULT_TEMPLATE_SLUG;
        dbTemplate = await prisma.templates.findFirst({
          where: defaultSlug ? { slug: defaultSlug } : { isActive: true },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!dbTemplate) {
        return apiError(new Error("No templates available. Please contact platform admin."), {
          route: "POST /api/onboarding",
          status: 500,
          safeMessage: "No templates available. Please contact platform admin.",
        });
      }

      const template =
        TEMPLATE_PRESETS[templateId as keyof typeof TEMPLATE_PRESETS] ||
        TEMPLATE_PRESETS.modern;

      const tenantId = crypto.randomUUID();

      const tenant = await prisma.tenants.create({
        data: {
          id: tenantId,
          businessName,
          subdomain,
          nftTokenId,
          countryCode: countryCode || "PT",
          isActive: true,
          templateId: dbTemplate.id,
          updatedAt: new Date(),
          // PRD-213 AC-2a: persist the accepted DPA version + timestamp on the tenant.
          dpaAcceptedVersion: dpaVersion,
          dpaAcceptedAt: new Date(dpaAcceptedAt),
          dpaAcceptedByUserId: clerkUser.id,
          settings: {
            contactInfo,
            templatePreset: templateId || "modern",
            clerkOrgId: clerkOrg.id,
          },
        },
      });

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

      // Copy ALL base template files to tenant's own S3 path
      const templateSlug = dbTemplate.slug || dbTemplate.id;
      const sourceS3Prefix = `templates/${templateSlug}/`;
      const destS3Prefix = `tenants/${tenantId}/templates/${templateSlug}`;
      const destS3Dir = `${destS3Prefix}/`;

      let filesCopied = 0;
      let seedData: Record<string, any> = {};
      try {
        filesCopied = await copyS3Directory(sourceS3Prefix, destS3Dir);
        logger.info(`[onboarding] Copied ${filesCopied} files from ${sourceS3Prefix} to ${destS3Dir}`);

        // Read defaults.json to seed DB fields
        const defaults = await getJsonFromS3<any>(`${destS3Dir}defaults.json`);
        if (defaults) {
          if (defaults.designSystem) seedData.designSystem = defaults.designSystem;
          if (defaults.pageContent) seedData.pageContent = defaults.pageContent;
          if (defaults.navigation) seedData.navigation = defaults.navigation;
          if (defaults.footer) seedData.footer = defaults.footer;
          if (defaults.heroImagePath) {
            const hp = defaults.heroImagePath;
            const isAbsHero = hp.startsWith('development/') || hp.startsWith('tenants/') || hp.startsWith('templates/');
            seedData.heroImageUrl = isAbsHero ? hp : `${destS3Dir}${hp}`;
          }
          if (defaults.logoPath) {
            const lp = defaults.logoPath;
            const isAbsLogo = lp.startsWith('development/') || lp.startsWith('tenants/') || lp.startsWith('templates/');
            seedData.logoUrl = isAbsLogo ? lp : `${destS3Dir}${lp}`;
          }
        }
      } catch (err) {
        console.error("[onboarding] S3 copy failed, template will need manual setup:", err);
      }

      const tenantTemplateId = crypto.randomUUID();
      await prisma.tenant_templates.create({
        data: {
          id: tenantTemplateId,
          tenantId: tenant.id,
          baseTemplateId: dbTemplate.id,
          templateName: dbTemplate.name,
          s3Path: destS3Prefix,
          isActive: true,
          updatedAt: new Date(),
          ...seedData,
        },
      });

      await prisma.tenants.update({
        where: { id: tenant.id },
        data: { activeTenantTemplateId: tenantTemplateId },
      });

      // PRD-213 AC-2b: record DPA acceptance in the audit trail (Art. 28 proof).
      await createAuditLog({
        action: DPA_ACCEPTED_AUDIT_ACTION,
        entityType: "Tenant",
        entityId: tenant.id,
        userId: clerkUser.id,
        userEmail: email,
        tenantId: tenant.id,
        metadata: {
          dpaVersion,
          dpaAcceptedAt,
          businessName,
        },
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "unknown",
      });

      // 6. Create Local User (mirroring Clerk User)
      await prisma.users.upsert({
        where: { email },
        update: {
          name: businessName,
          role: "TENANT_ADMIN",
          tenantId: tenant.id,
          updatedAt: new Date(),
        },
        create: {
          id: crypto.randomUUID(),
          email,
          password: "CLERK_MANAGED_ACCOUNT",
          name: businessName,
          role: "TENANT_ADMIN",
          tenantId: tenant.id,
          updatedAt: new Date(),
        }
      });

      // 7. Send Welcome Email (fire-and-forget)
      const html = await emailTemplates.tenantWelcome(
        businessName,
        businessName,
        subdomain,
      );
      sendEmail({
        to: email,
        subject: "Welcome to BudStacks - Your Store is Ready!",
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
        clerkOrgId: clerkOrg.id,
      });

    } catch (dbError: any) {
      // DB operations failed — rollback Clerk records to prevent orphans
      console.error("DB creation failed, rolling back Clerk records:", dbError);
      try {
        const rollbackClient = await clerkClient();
        await rollbackClient.organizations.deleteOrganization(clerkOrg.id);
        await rollbackClient.users.deleteUser(clerkUser.id);
        logger.info("Clerk rollback successful");
      } catch (rollbackError) {
        console.error("Clerk rollback failed (orphaned records):", rollbackError);
      }
      throw dbError; // Re-throw so outer catch returns 500
    }

  } catch (error: any) {
    console.error("Onboarding error:", error);
    return apiError(error, {
      route: "POST /api/onboarding",
      safeMessage: "Internal server error",
    });
  }
}
