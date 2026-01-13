
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, emailTemplates } from '@/lib/email';
import { getCurrentTenant } from '@/lib/tenant';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const tenant = await getCurrentTenant();

    // Find user by email
    const user = await prisma.users.findFirst({
      where: tenant?.id ? { email, tenantId: tenant.id } : { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If an account exists with this email, you will receive password reset instructions.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await prisma.users.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Create reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`;

    // Send password reset email
    // Send password reset email
    const html = await emailTemplates.passwordReset(user.name || 'User', resetLink, 'BudStack');
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
      tenantId: user.tenantId || 'SYSTEM',
      templateName: 'passwordReset',
    }).catch((error) => {
      console.error('Failed to send password reset email:', error);
    });

    return NextResponse.json({
      message: 'If an account exists with this email, you will receive password reset instructions.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
