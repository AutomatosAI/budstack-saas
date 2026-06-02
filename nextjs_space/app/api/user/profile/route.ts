import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";

export const PATCH = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = body;

    // Build address object if any address fields provided
    const address =
      addressLine1 || city || state || postalCode || country
        ? {
          addressLine1: addressLine1 || "",
          addressLine2: addressLine2 || "",
          city: city || "",
          state: state || "",
          postalCode: postalCode || "",
          country: country || "",
        }
        : undefined;

    // Update user with name constructed from firstName + lastName
    const fullName =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName || lastName || undefined;

    // Resolve DB user — try by Clerk ID first, fall back to email for legacy rows
    let dbUser = await prisma.users.findUnique({ where: { id: user.id } });
    if (!dbUser && user.email) {
      dbUser = await prisma.users.findUnique({ where: { email: user.email } });
    }

    if (!dbUser) {
      if (!user.email) {
        return apiError(
          new Error("User record not found and no email available"),
          {
            route: "PATCH /api/user/profile",
            status: 404,
            safeMessage: "User record not found and no email available",
          },
        );
      }
      // Create a minimal record so settings page works for Clerk-only users
      dbUser = await prisma.users.create({
        data: {
          id: user.id,
          email: user.email,
          password: "",
          updatedAt: new Date(),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(fullName && { name: fullName }),
          ...(phone && { phone }),
          ...(address && { address }),
        },
      });
    }

    const updatedUser = await prisma.users.update({
      where: { id: dbUser.id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(fullName && { name: fullName }),
        ...(phone !== undefined && { phone }),
        ...(address && { address }),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        address: updatedUser.address,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return apiError(error, {
      route: "PATCH /api/user/profile",
      safeMessage: "Failed to update profile",
    });
  }
});
