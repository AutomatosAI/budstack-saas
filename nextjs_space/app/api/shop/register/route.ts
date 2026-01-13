import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createClient } from '@/lib/doctor-green-api';
import { prisma } from '@/lib/db';
import { getCurrentTenant } from '@/lib/tenant';
import { getTenantDrGreenConfig } from '@/lib/tenant-config';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { personal, address, medicalRecord } = body;

    // Validate required fields
    if (!personal || !address || !medicalRecord) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current tenant for Dr. Green API keys
    const tenant = await getCurrentTenant();

    // Resolve credentials (tenant-specific or platform env fallback)
    let config = {
      apiKey: process.env.DR_GREEN_API_KEY || '',
      secretKey: process.env.DR_GREEN_SECRET_KEY || '',
    };

    if (tenant?.id) {
      try {
        config = await getTenantDrGreenConfig(tenant.id);
      } catch (error) {
        console.warn(
          `Using platform Dr. Green credentials fallback: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (!config.apiKey || !config.secretKey) {
      console.error('Missing Dr. Green API credentials for registration');
      // Continue anyway? The createClient might fail or we should block.
      // createClient throws 'MISSING_CREDENTIALS` if keys are missing.
      // We'll let it proceed and fail inside if needed, or handle it here.
    }

    // Create client in Dr. Green system
    const result = await createClient({
      firstName: personal.firstName,
      lastName: personal.lastName,
      email: personal.email,
      phone: personal.phone,
      dateOfBirth: personal.dateOfBirth,
      address: {
        street: address.street,
        city: address.city,
        postalCode: address.postalCode,
        country: address.country,
      },
      medicalRecord: {
        conditions: medicalRecord.conditions,
        currentMedications: medicalRecord.currentMedications,
        allergies: medicalRecord.allergies,
        previousCannabisUse: medicalRecord.previousCannabisUse,
        doctorApproval: medicalRecord.doctorApproval,
      },
    }, config);

    // Update user with additional info
    await prisma.users.update({
      where: { id: session.user.id },
      data: {
        name: `${personal.firstName} ${personal.lastName}`,
      },
    });

    return NextResponse.json({
      success: true,
      clientId: result.clientId,
      kycLink: result.kycLink,
    });
  } catch (error: any) {
    console.error('Patient registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register patient' },
      { status: 500 }
    );
  }
}
