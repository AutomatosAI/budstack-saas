
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sendEmail, emailTemplates } from '@/lib/email';
import crypto from 'crypto';

const TEMPLATE_PRESETS = {
  modern: {
    primaryColor: '#10b981',
    secondaryColor: '#059669',
    accentColor: '#34d399',
    fontFamily: 'Inter',
  },
  medical: {
    primaryColor: '#3b82f6',
    secondaryColor: '#2563eb',
    accentColor: '#60a5fa',
    fontFamily: 'Inter',
  },
  natural: {
    primaryColor: '#84cc16',
    secondaryColor: '#65a30d',
    accentColor: '#a3e635',
    fontFamily: 'Inter',
  },
  premium: {
    primaryColor: '#8b5cf6',
    secondaryColor: '#7c3aed',
    accentColor: '#a78bfa',
    fontFamily: 'Inter',
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessName, email, password, subdomain, nftTokenId, contactInfo, countryCode, templateId } = body;

    // Validation
    if (!businessName || !email || !password || !subdomain || !nftTokenId || !countryCode) {
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
        { error: 'Subdomain already taken' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.users.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Get actual template from database or fallback to healingbuds
    let dbTemplate = await prisma.templates.findFirst({
      where: { slug: templateId || 'healingbuds' },
    });

    // If requested template not found, use healingbuds as default
    if (!dbTemplate) {
      dbTemplate = await prisma.templates.findFirst({
        where: { slug: 'healingbuds' },
      });
    }

    // If still no template, create a basic one (safety fallback)
    if (!dbTemplate) {
      console.error('[CRITICAL] No templates found in database! Creating default template.');
      dbTemplate = await prisma.templates.create({
        data: {
          name: 'HealingBuds Default',
          slug: 'healingbuds',
          description: 'Default medical cannabis template',
          category: 'medical',
          version: '1.0.0',
          author: 'BudStack',
          isActive: true,
        },
      });
    }

    // Get template branding colors
    const template = TEMPLATE_PRESETS[templateId as keyof typeof TEMPLATE_PRESETS] || TEMPLATE_PRESETS.modern;

    // Create tenant with actual template relation
    const tenant = await prisma.tenants.create({
      data: {
        id: crypto.randomUUID(),
        businessName,
        subdomain,
        nftTokenId,
        countryCode: countryCode || 'PT',
        isActive: false, // Requires super admin approval
        templateId: dbTemplate.id, // Assign actual database template
        updatedAt: new Date(),
        settings: {
          contactInfo,
          templatePreset: templateId || 'modern', // Store preset for colors
        },
      },
    });

    // Create tenant branding with template colors
    await prisma.tenant_branding.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        accentColor: template.accentColor,
        fontFamily: template.fontFamily,
        updatedAt: new Date(),
      },
    });

    // Create tenant admin user
    await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email,
        password: hashedPassword,
        name: businessName,
        role: 'TENANT_ADMIN',
        tenantId: tenant.id,
        updatedAt: new Date(),
      },
    });

    // Send tenant welcome email (don't wait for it)
    // Send tenant welcome email (don't wait for it)
    const html = await emailTemplates.tenantWelcome(businessName, businessName, subdomain);
    sendEmail({
      to: email,
      subject: 'Welcome to BudStack - Your Store is Ready!',
      html,
      tenantId: tenant.id,
      templateName: 'tenantWelcome',
    }).catch((error) => {
      console.error('Failed to send tenant welcome email:', error);
    });

    return NextResponse.json({
      message: 'Application submitted successfully',
      tenantId: tenant.id,
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
