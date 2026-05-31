import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail, emailTemplates } from '@/lib/email';
import { getCurrentTenant } from '@/lib/tenant';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import crypto from 'crypto';

const resetPasswordSchema = z.object({
  email: z.string().email().max(254),
});

// SECURITY (C11): Floor every response at this many ms so the no-user
// branch and the real-user branch are indistinguishable from network
// timing alone — closes the email-enumeration oracle.
const RESPONSE_FLOOR_MS = 500;

const safeSuccessResponse = NextResponse.json({
  message:
    "If an account exists with this email, you will receive password reset instructions.",
});

async function delayUntil(deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  const deadline = start + RESPONSE_FLOOR_MS;

  try {
    // SECURITY (C11): Rate-limit per IP to prevent enumeration sweeps
    // and email-bombing of arbitrary inboxes.
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = await checkRateLimit(`reset-password:${ip}`, {
      maxRequests: 5,
      windowMs: 60_000,
      failMode: 'closed',
    });
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = resetPasswordSchema.safeParse(rawBody);
    if (!parseResult.success) {
      await delayUntil(deadline);
      return NextResponse.json(
        { error: 'Invalid email' },
        { status: 400 },
      );
    }
    const email = parseResult.data.email.toLowerCase();

    // SECURITY (M14): Require tenant context. Do NOT fall back to a
    // platform-wide email lookup — that would let any subdomain reset any
    // user's password regardless of which tenant they actually belong to.
    const tenant = await getCurrentTenant();
    if (!tenant) {
      await delayUntil(deadline);
      return safeSuccessResponse;
    }

    const user = await prisma.users.findFirst({
      where: { email, tenantId: tenant.id },
    });

    if (!user) {
      await delayUntil(deadline);
      return safeSuccessResponse;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3_600_000); // 1 hour

    await prisma.users.update({
      where: { id: user.id },
      data: {
        resetToken: resetTokenHash,
        resetTokenExpiry,
      },
    });

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password/${resetToken}`;

    const html = await emailTemplates.passwordReset(
      user.name || 'User',
      resetLink,
      tenant.businessName || 'BudStacks',
    );
    await sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
      tenantId: user.tenantId || tenant.id,
      templateName: 'passwordReset',
    }).catch((error) => {
      console.error('Failed to send password reset email:', error);
    });

    await delayUntil(deadline);
    return safeSuccessResponse;
  } catch (error) {
    console.error('Password reset error:', error);
    await delayUntil(deadline);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 },
    );
  }
}
