import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/customer/profile
 * Get current user's profile
 * Authorization: Authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ profile: user });
  } catch (error) {
    console.error("[GET /api/customer/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/customer/profile
 * Update current user's profile
 * Authorization: Authenticated user
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, address } = body;

    // Update user profile
    const updatedUser = await prisma.users.update({
      where: { id: session.user.id },
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
  } catch (error) {
    console.error("[PATCH /api/customer/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
