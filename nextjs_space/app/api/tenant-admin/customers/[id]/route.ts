import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-auth";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { fetchClientByEmail, updateClient } from "@/lib/drgreen/doctor-green-api";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { eraseUser } from "@/lib/gdpr/erasure";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { logger } from "@/lib/logger";

const customerUpdateSchema = z
  .object({
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z
      .string()
      .max(32)
      .regex(/^[0-9+()\-.\s]*$/, "Invalid phone number")
      .optional(),
    address: z
      .object({
        street: z.string().max(200),
        city: z.string().max(120),
        state: z.string().max(120),
        zip: z.string().max(20),
        country: z.string().max(120),
      })
      .partial()
      .strict()
      .optional(),
    drGreenClientId: z.string().max(200).optional(),
    verifyKyc: z.boolean().optional(),
    newEmail: z.string().email().max(200).optional(),
  })
  .strict();

/**
 * GET /api/tenant-admin/customers/[id]
 * Get customer details
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export const GET = withAuth(async (_request, { user }, params) => {
  try {
    const email = user.email;
    const role = user.role;

    if (!email) {
      return apiError(new Error("Email not found"), {
        route: "GET /api/tenant-admin/customers/[id]",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/tenant-admin/customers/[id]",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const id = parseUuid(params.id);

    // Fetch local user to get tenantId for authorization
    const localUser = await prisma.users.findFirst({
      where: { email: email },
    });

    if (!localUser && role !== "SUPER_ADMIN") {
      return apiError(new Error("User not found"), {
        route: "GET /api/tenant-admin/customers/[id]",
        status: 404,
        safeMessage: "User not found",
      });
    }

    // Get customer
    const customer = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        consultations: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!customer) {
      return apiError(new Error("Customer not found"), {
        route: "GET /api/tenant-admin/customers/[id]",
        status: 404,
        safeMessage: "Customer not found",
      });
    }

    // Verify tenant access for tenant admins
    if (
      role === "TENANT_ADMIN" &&
      customer.tenantId !== localUser?.tenantId
    ) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/tenant-admin/customers/[id]",
        status: 403,
        safeMessage: "Unauthorized",
      });
    }

    // Get medical history (consultation questionnaires)
    const medicalHistory = await prisma.consultationQuestionnaire.findMany({
      where: { email: customer.email },
      select: {
        id: true,
        medicalConditions: true,
        prescribedMedications: true,
        hasHeartProblems: true,
        hasCancerTreatment: true,
        hasLiverDisease: true,
        hasPsychiatricHistory: true,
        kycLink: true,
        isKycVerified: true,
        adminApproval: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    return NextResponse.json({
      customer,
      medicalHistory: medicalHistory[0] || null,
    });
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/customers/[id]" });
  }
});

/**
 * PATCH /api/tenant-admin/customers/[id]
 * Update customer profile
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export const PATCH = withAuth(async (request, { user }, params) => {
  try {
    const email = user.email;
    const role = user.role;

    if (!email) {
      return apiError(new Error("Email not found"), {
        route: "PATCH /api/tenant-admin/customers/[id]",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return apiError(new Error("Unauthorized"), {
        route: "PATCH /api/tenant-admin/customers/[id]",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const id = parseUuid(params.id);

    // Fetch local user to get tenantId for authorization
    // Fetch local user to get tenantId for authorization
    const localUser = await prisma.users.findFirst({
      where: { email: email },
    });

    if (!localUser && role !== "SUPER_ADMIN") {
      return apiError(new Error("User not found"), {
        route: "PATCH /api/tenant-admin/customers/[id]",
        status: 404,
        safeMessage: "User not found",
      });
    }

    const body = await parseJsonBody(request, customerUpdateSchema);
    const { firstName, lastName, phone, address, drGreenClientId, verifyKyc, newEmail } = body;

    // Get existing customer
    const existingCustomer = await prisma.users.findUnique({
      where: { id },
      select: { id: true, tenantId: true, email: true, drGreenClientId: true },
    });

    if (!existingCustomer) {
      return apiError(new Error("Customer not found"), {
        route: "PATCH /api/tenant-admin/customers/[id]",
        status: 404,
        safeMessage: "Customer not found",
      });
    }

    // Verify tenant access for tenant admins
    if (
      role === "TENANT_ADMIN" &&
      existingCustomer.tenantId !== localUser?.tenantId
    ) {
      return apiError(new Error("Unauthorized"), {
        route: "PATCH /api/tenant-admin/customers/[id]",
        status: 403,
        safeMessage: "Unauthorized",
      });
    }

    // Handle email change
    const isEmailChange = newEmail && newEmail.toLowerCase().trim() !== existingCustomer.email.toLowerCase().trim();
    let drGreenSyncResult: { success: boolean; error?: string } | null = null;
    let clerkSyncResult: { success: boolean; error?: string } | null = null;

    if (isEmailChange) {
      const normalizedNewEmail = newEmail.toLowerCase().trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedNewEmail)) {
        return apiValidationError(
          "Invalid email format",
          "PATCH /api/tenant-admin/customers/[id]",
        );
      }

      // Check email not already in use in local DB
      const existingWithEmail = await prisma.users.findFirst({
        where: { email: { equals: normalizedNewEmail, mode: 'insensitive' } },
      });
      if (existingWithEmail) {
        return apiError(new Error("Email already in use by another account"), {
          route: "PATCH /api/tenant-admin/customers/[id]",
          status: 409,
          safeMessage: "Email already in use by another account",
        });
      }

      // Sync email change to Clerk
      try {
        const clerk = await clerkClient();
        // Find Clerk user by old email
        const clerkUsers = await clerk.users.getUserList({
          emailAddress: [existingCustomer.email],
          limit: 1,
        });
        const clerkUser = clerkUsers.data[0];

        if (clerkUser) {
          // Add new email address (verified, since admin-initiated)
          const newEmailObj = await clerk.emailAddresses.createEmailAddress({
            userId: clerkUser.id,
            emailAddress: normalizedNewEmail,
            verified: true,
            primary: false,
          });

          // Set new email as primary
          await clerk.emailAddresses.updateEmailAddress(newEmailObj.id, {
            primary: true,
          });

          // Remove old email address
          const oldEmailObj = clerkUser.emailAddresses.find(
            (e) => e.emailAddress.toLowerCase() === existingCustomer.email.toLowerCase()
          );
          if (oldEmailObj && oldEmailObj.id !== newEmailObj.id) {
            await clerk.emailAddresses.deleteEmailAddress(oldEmailObj.id);
          }

          clerkSyncResult = { success: true };
          logger.info("[Email Change] Clerk user email updated", { clerkUserId: clerkUser.id, newEmail: normalizedNewEmail });
        } else {
          clerkSyncResult = { success: false, error: "User not found in Clerk" };
          console.warn(`[Email Change] No Clerk user found for ${existingCustomer.email}`);
        }
      } catch (clerkError: any) {
        clerkSyncResult = { success: false, error: clerkError.message || String(clerkError) };
        console.error(`[Email Change] Clerk sync failed:`, clerkError.message || clerkError);
        // Continue with local + Dr Green update — don't block on Clerk failure
      }

      // Sync email change to Dr Green
      if (existingCustomer.tenantId) {
        try {
          const drGreenConfig = await getTenantDrGreenConfig(existingCustomer.tenantId);

          // Find Dr Green client by stored ID or by old email
          let drGreenClientUUID = existingCustomer.drGreenClientId;

          if (!drGreenClientUUID) {
            const drGreenClient = await fetchClientByEmail(existingCustomer.email, drGreenConfig);
            if (drGreenClient) {
              drGreenClientUUID = drGreenClient.id;
              logger.info("[Email Change] Found Dr Green client by email", { drGreenClientId: drGreenClient.id });
            }
          }

          if (drGreenClientUUID) {
            await updateClient(drGreenClientUUID, { email: normalizedNewEmail }, drGreenConfig);
            drGreenSyncResult = { success: true };
            logger.info("[Email Change] Dr Green client email updated", { drGreenClientId: drGreenClientUUID });
          } else {
            drGreenSyncResult = { success: false, error: "Client not found in Dr Green" };
            console.warn(`[Email Change] No Dr Green client found for ${existingCustomer.email}`);
          }
        } catch (drGreenError: any) {
          drGreenSyncResult = { success: false, error: drGreenError.message };
          console.error(`[Email Change] Dr Green sync failed:`, drGreenError.message);
        }
      }
    }

    const normalizedNewEmail = isEmailChange ? newEmail.toLowerCase().trim() : undefined;

    // Update customer (only allowed fields)
    const updatedCustomer = await prisma.users.update({
      where: { id },
      data: {
        ...(normalizedNewEmail && { email: normalizedNewEmail }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(drGreenClientId !== undefined && { drGreenClientId }),
        // Update name for backward compatibility
        ...(firstName && lastName && { name: `${firstName} ${lastName}` }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        isActive: true,
      },
    });

    // If email changed, also update consultation_questionnaires
    if (isEmailChange && normalizedNewEmail) {
      await prisma.consultation_questionnaires.updateMany({
        where: {
          email: { equals: existingCustomer.email, mode: 'insensitive' },
          ...(existingCustomer.tenantId && { tenantId: existingCustomer.tenantId }),
        },
        data: {
          email: normalizedNewEmail,
          updatedAt: new Date(),
        },
      });
      logger.info("[Email Change] Updated consultation questionnaires", { oldEmail: existingCustomer.email, newEmail: normalizedNewEmail });
    }

    // If admin is verifying KYC, update the questionnaire too
    if (verifyKyc) {
      const kycEmail = normalizedNewEmail || existingCustomer.email;
      await prisma.consultation_questionnaires.updateMany({
        where: {
          email: { equals: kycEmail, mode: 'insensitive' },
          ...(existingCustomer.tenantId && { tenantId: existingCustomer.tenantId }),
        },
        data: {
          isKycVerified: true,
          adminApproval: "APPROVED",
          updatedAt: new Date(),
        },
      });
      logger.info("Admin verified KYC", { email: kycEmail });
    }

    // Create audit log — createAuditLog redacts PII in metadata automatically
    await createAuditLog({
      action: isEmailChange
        ? AUDIT_ACTIONS.CUSTOMER_EMAIL_CHANGED
        : verifyKyc
          ? AUDIT_ACTIONS.CUSTOMER_KYC_VERIFIED
          : AUDIT_ACTIONS.CUSTOMER_UPDATED,
      entityType: "User",
      entityId: id,
      userId: user.id,
      userEmail: email!,
      tenantId: existingCustomer.tenantId || undefined,
      metadata: {
        targetUserEmail: existingCustomer.email,
        ...(isEmailChange && {
          oldEmail: existingCustomer.email,
          newEmail: normalizedNewEmail,
          clerkSync: clerkSyncResult,
          drGreenSync: drGreenSyncResult,
        }),
        changes: body,
      },
      ...getClientInfo(request.headers),
    });

    // Build status message for email changes
    let message: string;
    if (isEmailChange) {
      const failures: string[] = [];
      if (clerkSyncResult && !clerkSyncResult.success) failures.push("Clerk");
      if (drGreenSyncResult && !drGreenSyncResult.success) failures.push("Dr Green");
      message = failures.length > 0
        ? `Email updated but sync failed for: ${failures.join(", ")}`
        : "Email updated across all systems";
    } else {
      message = verifyKyc ? "Customer verified successfully" : "Customer updated successfully";
    }

    return NextResponse.json({
      message,
      customer: updatedCustomer,
      ...(isEmailChange && {
        clerkSync: clerkSyncResult,
        drGreenSync: drGreenSyncResult,
      }),
    });
  } catch (error) {
    return apiError(error, { route: "PATCH /api/tenant-admin/customers/[id]" });
  }
});

/**
 * DELETE /api/tenant-admin/customers/[id]
 * GDPR deletion - hard delete or anonymize customer
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export const DELETE = withAuth(async (request, { user }, params) => {
  try {
    const email = user.email;
    const role = user.role;

    if (!email) {
      return apiError(new Error("Email not found"), {
        route: "DELETE /api/tenant-admin/customers/[id]",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return apiError(new Error("Unauthorized"), {
        route: "DELETE /api/tenant-admin/customers/[id]",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const id = parseUuid(params.id);

    // Fetch local user to get tenantId for authorization
    const localUser = await prisma.users.findFirst({
      where: { email: email },
    });

    if (!localUser && role !== "SUPER_ADMIN") {
      return apiError(new Error("User not found"), {
        route: "DELETE /api/tenant-admin/customers/[id]",
        status: 404,
        safeMessage: "User not found",
      });
    }

    // Get existing customer (existence check + tenant-access authorization).
    const existingCustomer = await prisma.users.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });

    if (!existingCustomer) {
      return apiError(new Error("Customer not found"), {
        route: "DELETE /api/tenant-admin/customers/[id]",
        status: 404,
        safeMessage: "Customer not found",
      });
    }

    // Verify tenant access for tenant admins
    if (
      role === "TENANT_ADMIN" &&
      existingCustomer.tenantId !== localUser?.tenantId
    ) {
      return apiError(new Error("Unauthorized"), {
        route: "DELETE /api/tenant-admin/customers/[id]",
        status: 403,
        safeMessage: "Unauthorized",
      });
    }

    // GDPR erasure via the canonical shared path (lib/gdpr/erasure.ts): nulls
    // PII, severs the Dr Green linkage, and writes a redacted `admin_assisted`
    // audit row. Idempotent; order/consultation history is retained via the FK.
    await eraseUser({
      userId: id,
      reason: "admin_assisted",
      actingAdminId: user.id,
      clientInfo: getClientInfo(request.headers),
    });

    return NextResponse.json({
      message: "Customer deleted successfully (GDPR compliant)",
      customerId: id,
    });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/customers/[id]" });
  }
});
