import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * POST /api/customer/change-password
 * Change current user's password
 * Authorization: Authenticated user
 */
export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { oldPassword, newPassword } = body;

        // Validate input
        if (!oldPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Old password and new password are required' },
                { status: 400 }
            );
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: 'New password must be at least 8 characters long' },
                { status: 400 }
            );
        }

        // Get user with password
        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { id: true, password: true, email: true },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Verify old password
        const isValidPassword = await bcrypt.compare(oldPassword, user.password);
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.users.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        // Create audit log (optional - might be too sensitive)
        await prisma.audit_logs.create({
            data: {
                id: crypto.randomUUID(),
                action: 'PASSWORD_CHANGED',
                entityType: 'User',
                entityId: session.user.id,
                userId: session.user.id,
                userEmail: session.user.email,
                metadata: {
                    method: 'self-service',
                },
            },
        });

        return NextResponse.json({
            message: 'Password changed successfully',
        });
    } catch (error) {
        console.error('[POST /api/customer/change-password] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
