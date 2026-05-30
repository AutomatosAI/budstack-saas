import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/customer/profile — the current customer's profile.
 *
 * withAuth binds the HOST tenant around the handler, so the users lookup below
 * is auto-scoped by the lib/db tenant middleware (users is a tenant-scoped
 * model). This closes the prior host-blind `findFirst({ where: { email } })`
 * cross-tenant leak (PRD-203 AC-3): a customer from another tenant hitting this
 * storefront now misses (404) instead of reading their foreign row.
 */
export const GET = withAuth(async (_req, { user }) => {
  const email = user.email;
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const profile = await prisma.users.findFirst({
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
      tenantId: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
});

/**
 * PATCH /api/customer/profile — update the current customer's profile.
 * Tenant-scoped via the same withAuth host binding as GET (AC-3).
 */
export const PATCH = withAuth(async (req, { user }) => {
  const email = user.email;

  const body = await req.json();
  const { firstName, lastName, phone, address } = body;

  // Tenant-scoped by the bound host tenant — no foreign row can be selected.
  const existingUser = await prisma.users.findFirst({
    where: { email },
  });

  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updatedUser = await prisma.users.update({
    where: { id: existingUser.id },
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
      createdAt: true,
    },
  });

  return NextResponse.json({
    message: "Profile updated successfully",
    profile: updatedUser,
  });
});
