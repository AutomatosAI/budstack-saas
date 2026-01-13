import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

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
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      session.user.role === "TENANT_ADMIN" &&
      customer.tenantId !== session.user.tenantId
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
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, address } = body;

    // Get existing customer
    const existingCustomer = await prisma.users.findUnique({
      where: { id: params.id },
      select: { id: true, tenantId: true, email: true },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    // Verify tenant access for tenant admins
    if (
      session.user.role === "TENANT_ADMIN" &&
      existingCustomer.tenantId !== session.user.tenantId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update customer (only allowed fields)
    const updatedCustomer = await prisma.users.update({
      where: { id: params.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
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

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "CUSTOMER_UPDATED",
        entityType: "User",
        entityId: params.id,
        userId: session.user.id,
        userEmail: session.user.email,
        tenantId: existingCustomer.tenantId || undefined,
        metadata: {
          targetUserEmail: existingCustomer.email,
          changes: body,
        },
      },
    });

    return NextResponse.json({
      message: "Customer updated successfully",
      customer: updatedCustomer,
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
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      session.user.role === "TENANT_ADMIN" &&
      existingCustomer.tenantId !== session.user.tenantId
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
        userId: session.user.id,
        userEmail: session.user.email,
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
