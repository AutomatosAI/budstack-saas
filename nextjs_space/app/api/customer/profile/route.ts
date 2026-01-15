import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/customer/profile
 * Get current user's profile
 * Authorization: Authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const clerkUser = await currentUser();
    if (!clerkUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile - try to find by Clerk ID (if stored in externalId or id if synced) or email
    // Assuming migration maps Clerk ID to User ID or we look up by email
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const user = await prisma.users.findFirst({
      where: { email: email }, // Lookup by email for now as reliable link
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
    const clerkUser = await currentUser();
    if (!clerkUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const body = await request.json();
    const { firstName, lastName, phone, address } = body;

    // Find user by email first to get ID
    const existingUser = await prisma.users.findFirst({
      where: { email: email }
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user profile
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
  } catch (error) {
    console.error("[PATCH /api/customer/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
