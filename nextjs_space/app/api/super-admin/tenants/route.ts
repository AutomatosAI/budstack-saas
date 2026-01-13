import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

/**
 * GET /api/super-admin/tenants
 * List all tenants with pagination and filtering
 * Authorization: SUPER_ADMIN only
 */
export async function GET(request: NextRequest) {
    try {
        // Check authentication and authorization
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Rate limiting
        const rateLimitResult = await checkRateLimit(session.user.id);
        if (!rateLimitResult.success) {
            return rateLimitResult.response;
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status'); // 'active' | 'inactive'
        const country = searchParams.get('country') || '';

        // Build where clause
        const where: any = {};

        if (search) {
            where.OR = [
                { businessName: { contains: search, mode: 'insensitive' } },
                { subdomain: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (status === 'active') {
            where.isActive = true;
        } else if (status === 'inactive') {
            where.isActive = false;
        }

        if (country) {
            where.countryCode = country;
        }

        // Get total count
        const total = await prisma.tenants.count({ where });

        // Get tenants with pagination
        const tenants = await prisma.tenants.findMany({
            where,
            include: {
                users: {
                    where: { role: 'TENANT_ADMIN' },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        firstName: true,
                        lastName: true,
                        createdAt: true,
                    },
                    take: 1, // Get first admin user
                },
                _count: {
                    select: {
                        users: true,
                        products: true,
                        orders: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return NextResponse.json({
            tenants,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('[GET /api/super-admin/tenants] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/super-admin/tenants
 * Create a new tenant with admin user
 * Authorization: SUPER_ADMIN only
 */
export async function POST(request: NextRequest) {
    try {
        // Check authentication and authorization
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'SUPER_ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Rate limiting
        const rateLimitResult = await checkRateLimit(session.user.id);
        if (!rateLimitResult.success) {
            return rateLimitResult.response;
        }

        const body = await request.json();
        const {
            businessName,
            subdomain,
            countryCode,
            adminEmail,
            adminFirstName,
            adminLastName,
            adminPassword,
        } = body;

        // Validate required fields
        if (!businessName || !subdomain || !adminEmail || !adminPassword) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if subdomain already exists
        const existingTenant = await prisma.tenants.findUnique({
            where: { subdomain },
        });

        if (existingTenant) {
            return NextResponse.json(
                { error: 'Subdomain already exists' },
                { status: 400 }
            );
        }

        // Check if admin email already exists
        const existingUser = await prisma.users.findUnique({
            where: { email: adminEmail },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already exists' },
                { status: 400 }
            );
        }

        // Hash password
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create tenant and admin user in transaction
        const tenant = await prisma.$transaction(async (tx: any) => {
            // Create tenant
            const newTenant = await tx.tenant.create({
                data: {
                    businessName,
                    subdomain,
                    countryCode: countryCode || 'PT',
                    isActive: true,
                },
            });

            // Create admin user
            await tx.user.create({
                data: {
                    email: adminEmail,
                    password: hashedPassword,
                    name: `${adminFirstName || ''} ${adminLastName || ''}`.trim() || adminEmail,
                    firstName: adminFirstName,
                    lastName: adminLastName,
                    role: 'TENANT_ADMIN',
                    tenantId: newTenant.id,
                    isActive: true,
                },
            });

            // Create default branding
            await tx.tenantBranding.create({
                data: {
                    tenantId: newTenant.id,
                },
            });

            return newTenant;
        });

        // Create audit log
        await prisma.audit_logs.create({
            data: {
                id: crypto.randomUUID(),
                action: 'TENANT_CREATED',
                entityType: 'Tenant',
                entityId: tenant.id,
                userId: session.user.id,
                userEmail: session.user.email,
                metadata: {
                    businessName,
                    subdomain,
                    adminEmail,
                },
            },
        });

        return NextResponse.json(
            {
                message: 'Tenant created successfully',
                tenant,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('[POST /api/super-admin/tenants] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
