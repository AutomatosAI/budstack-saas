import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

/**
 * GDPR Article 15 / 20 — Right to access and data portability.
 *
 * Returns a JSON dump of the authenticated user's personal data, plus the
 * orders / consultations / questionnaires they own. Rate-limited to prevent
 * abuse (an attacker with stolen credentials shouldn't be able to scrape
 * a user's full record on demand). Self-service only — admins use the
 * tenant-admin customer routes for assisted exports.
 */
export const GET = withAuth(async (request, { user }) => {
  try {
    const email = user.email;

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    // 3 exports per hour per user — generous for legitimate use, restrictive
    // enough that it's not a useful scraping primitive.
    const rate = await checkRateLimit(`account-export:${user.id}`, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      failMode: "closed",
    });
    if (!rate.success) return rate.response;

    const dbUser = await prisma.users.findFirst({
      where: { email },
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
        updatedAt: true,
        tenantId: true,
        drGreenClientId: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [orders, consultations, questionnaires] = await Promise.all([
      prisma.orders.findMany({
        where: { userId: dbUser.id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.consultations.findMany({
        where: { userId: dbUser.id },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.consultation_questionnaires.findMany({
        where: { email: { equals: dbUser.email, mode: "insensitive" } },
        select: {
          id: true,
          isKycVerified: true,
          adminApproval: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    await createAuditLog({
      action: AUDIT_ACTIONS.ACCOUNT_DATA_EXPORTED,
      entityType: "User",
      entityId: dbUser.id,
      userId: user.id,
      userEmail: email,
      tenantId: dbUser.tenantId || undefined,
      metadata: {
        recordCounts: {
          orders: orders.length,
          consultations: consultations.length,
          questionnaires: questionnaires.length,
        },
      },
      ...getClientInfo(request.headers),
    });

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      profile: dbUser,
      orders,
      consultations,
      questionnaires,
      notes: [
        "This export contains the personal data we hold about you in the BudStack platform.",
        "It does not include data held by integrated providers (e.g. Dr Green, Clerk) — request those from the providers directly.",
      ],
    });
  } catch (error) {
    return apiError(error, {
      route: "account.export",
      status: 500,
      safeMessage: "Failed to export account data",
    });
  }
});
