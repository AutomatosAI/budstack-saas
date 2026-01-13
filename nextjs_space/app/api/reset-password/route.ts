import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password required' },
                { status: 400 }
            );
        }

        // Check if user exists
        const user = await prisma.users.findFirst({
            where: { email: email.toLowerCase() },
        });

        if (!user) {
            // Get tenant for healingbuds
            const tenant = await prisma.tenants.findUnique({
                where: { subdomain: 'healingbuds' },
            });

            if (!tenant) {
                return NextResponse.json(
                    { error: 'Tenant not found' },
                    { status: 404 }
                );
            }

            // Create user
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = await prisma.users.create({
                data: {
                    id: crypto.randomUUID(),
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    name: 'Gerard Kavanagh',
                    role: 'PATIENT',
                    tenantId: tenant.id,
                    updatedAt: new Date(),
                },
            });

            return NextResponse.json({
                success: true,
                message: 'User created',
                user: {
                    email: newUser.email,
                    name: newUser.name,
                },
            });
        }

        // Update password
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.users.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
            user: {
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Password reset error:', error);
        return NextResponse.json(
            { error: 'Failed to reset password', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
