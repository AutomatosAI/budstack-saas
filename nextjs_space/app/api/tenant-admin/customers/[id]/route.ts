import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { getTenantDrGreenConfig } from "@/lib/tenant-config";
import { fetchClientByEmail, updateClient } from "@/lib/doctor-green-api";

/**
 * GET /api/tenant-admin/customers/[id]
 * Get customer details
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
    const email = primaryEmail || user.emailAddresses[0]?.emailAddress;
    const role = (user.publicMetadata.role as string) || "";

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch local user to get tenantId for authorization
    const localUser = await prisma.users.findFirst({
      where: { email: email },
    });

    if (!localUser && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get customer
    const customer = await prisma.users.findUnique({
      where: { id: params.id },
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
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    // Verify tenant access for tenant admins
    if (
      role === "TENANT_ADMIN" &&
      customer.tenantId !== localUser?.tenantId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
    console.error(
      `[GET /api/tenant-admin/customers/${params.id}] Error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/tenant-admin/customers/[id]
 * Update customer profile
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication
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

    // Fetch local user to get tenantId for authorization
    // Fetch local user to get tenantId for authorization
    const localUser = await prisma.users.findFirst({
      where: { email: email },
    });

    if (!localUser && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, address, drGreenClientId, verifyKyc, newEmail } = body;

    // Get existing customer
    const existingCustomer = await prisma.users.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, email: true, drGreenClientId: true },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    // Verify tenant access for tenant admins
    if (
      role === "TENANT_ADMIN" &&
      existingCustomer.tenantId !== localUser?.tenantId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Handle email change
    const isEmailChange = newEmail && newEmail.toLowerCase().trim() !== existingCustomer.email.toLowerCase().trim();
    let drGreenSyncResult: { success: boolean; error?: string } | null = null;

    if (isEmailChange) {
      const normalizedNewEmail = newEmail.toLowerCase().trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedNewEmail)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }

      // Check email not already in use in local DB
      const existingWithEmail = await prisma.users.findFirst({
        where: { email: { equals: normalizedNewEmail, mode: 'insensitive' } },
      });
      if (existingWithEmail) {
        return NextResponse.json(
          { error: "Email already in use by another account" },
          { status: 409 },
        );
      }

      // Sync email change to Dr Green
      if (existingCustomer.tenantId) {
        try {
          const drGreenConfig = await getTenantDrGreenConfig(existingCustomer.tenantId);

          // Find Dr Green client by stored ID or by old email
          let drGreenClientUUID = existingCustomer.drGreenClientId;

          if (!drGreenClientUUID) {
            // No stored ID — search Dr Green by old email
            const drGreenClient = await fetchClientByEmail(existingCustomer.email, drGreenConfig);
            if (drGreenClient) {
              drGreenClientUUID = drGreenClient.id;
              console.log(`[Email Change] Found Dr Green client by email: ${drGreenClient.id}`);
            }
          }

          if (drGreenClientUUID) {
            await updateClient(drGreenClientUUID, { email: normalizedNewEmail }, drGreenConfig);
            drGreenSyncResult = { success: true };
            console.log(`[Email Change] Dr Green client ${drGreenClientUUID} email updated`);
          } else {
            drGreenSyncResult = { success: false, error: "Client not found in Dr Green" };
            console.warn(`[Email Change] No Dr Green client found for ${existingCustomer.email}`);
          }
        } catch (drGreenError: any) {
          drGreenSyncResult = { success: false, error: drGreenError.message };
          console.error(`[Email Change] Dr Green sync failed:`, drGreenError.message);
          // Continue with local update — don't block on Dr Green failure
        }
      }
    }

    const normalizedNewEmail = isEmailChange ? newEmail.toLowerCase().trim() : undefined;

    // Update customer (only allowed fields)
    const updatedCustomer = await prisma.users.update({
      where: { id: params.id },
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
      console.log(`[Email Change] Updated consultation questionnaires: ${existingCustomer.email} -> ${normalizedNewEmail}`);
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
      console.log(`Admin verified KYC for ${kycEmail}`);
    }

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: isEmailChange
          ? "CUSTOMER_EMAIL_CHANGED"
          : verifyKyc
            ? "CUSTOMER_KYC_VERIFIED"
            : "CUSTOMER_UPDATED",
        entityType: "User",
        entityId: params.id,
        userId: user.id,
        userEmail: email!,
        tenantId: existingCustomer.tenantId || undefined,
        metadata: {
          targetUserEmail: existingCustomer.email,
          ...(isEmailChange && {
            oldEmail: existingCustomer.email,
            newEmail: normalizedNewEmail,
            drGreenSync: drGreenSyncResult,
          }),
          changes: body,
        },
      },
    });

    const message = isEmailChange
      ? "Email updated successfully" + (drGreenSyncResult && !drGreenSyncResult.success ? " (Dr Green sync failed — update manually)" : "")
      : verifyKyc
        ? "Customer verified successfully"
        : "Customer updated successfully";

    return NextResponse.json({
      message,
      customer: updatedCustomer,
      ...(isEmailChange && { drGreenSync: drGreenSyncResult }),
    });
  } catch (error) {
    console.error(
      `[PATCH /api/tenant-admin/customers/${params.id}] Error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tenant-admin/customers/[id]
 * GDPR deletion - hard delete or anonymize customer
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication
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

    // Fetch local user to get tenantId for authorization
    const localUser = await prisma.users.findFirst({
      where: { email: email },
    });

    if (!localUser && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get existing customer
    const existingCustomer = await prisma.users.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, email: true, name: true },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    // Verify tenant access for tenant admins
    if (
      role === "TENANT_ADMIN" &&
      existingCustomer.tenantId !== localUser?.tenantId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // GDPR Deletion: Anonymize PII (keeping record for order history integrity)
    // Alternative: Hard delete with CASCADE on orders/consultations
    const anonymizedCustomer = await prisma.users.update({
      where: { id: params.id },
      data: {
        email: `deleted-${params.id}@deleted.com`,
        name: "Deleted User",
        firstName: null,
        lastName: null,
        phone: null,
        address: null,
        password: "DELETED",
        isActive: false,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "CUSTOMER_DELETED_GDPR",
        entityType: "User",
        entityId: params.id,
        userId: user.id,
        userEmail: email!,
        tenantId: existingCustomer.tenantId || undefined,
        metadata: {
          targetUserEmail: existingCustomer.email,
          targetUserName: existingCustomer.name,
          deletionType: "anonymization",
        },
      },
    });

    return NextResponse.json({
      message: "Customer deleted successfully (GDPR compliant)",
      customerId: params.id,
    });
  } catch (error) {
    console.error(
      `[DELETE /api/tenant-admin/customers/${params.id}] Error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
