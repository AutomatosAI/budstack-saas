import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedCore() {
  console.log('Seeding database core data...');

  // Create templates
  console.log('Skipping template creation (use seed-templates.ts instead)...');

  // Fetch HealingBuds template (assumes seed-templates.ts has run)
  const healingBudsTemplate = await prisma.template.findUnique({
    where: { slug: 'healingbuds' },
  });

  if (!healingBudsTemplate) {
    throw new Error('❌ Error: HealingBuds template not found. Run seed-templates.ts first.');
  }

  // Create HealingBuds Tenant (first tenant)
  console.log('Creating HealingBuds tenant...');



  const healingBudsTenant = await prisma.tenant.upsert({
    where: { subdomain: 'healingbuds' },
    update: {
      templateId: healingBudsTemplate.id,
    },
    create: {
      businessName: 'HealingBuds Portugal',
      subdomain: 'healingbuds',
      isActive: true,
      templateId: healingBudsTemplate.id,
      settings: {
        logoUrl: '/healingbuds-logo-white.jpeg',
        contactEmail: 'info@healingbuds.pt',
        contactPhone: '+351 21 234 5678',
        primaryColor: '#10b981', // green-500
        secondaryColor: '#059669', // green-600
      },
      drGreenApiUrl: 'https://stage-api.drgreennft.com/api/v1',
    },
  });

  console.log('HealingBuds tenant created:', healingBudsTenant.subdomain);

  // --- Create Wellness & Nature Tenant ---
  const wellnessTemplate = await prisma.template.findUnique({ where: { slug: 'wellness-nature' } });
  if (wellnessTemplate) {
    console.log('Creating Wellness & Nature tenant...');
    await prisma.tenant.upsert({
      where: { subdomain: 'wellness' },
      update: { templateId: wellnessTemplate.id },
      create: {
        businessName: 'Wellness & Nature Co',
        subdomain: 'wellness',
        isActive: true,
        templateId: wellnessTemplate.id,
        settings: {
          logoUrl: '/wellness-logo.png',
          contactEmail: 'hello@wellnessnature.com',
          primaryColor: '#5F8D4E',
          secondaryColor: '#285430',
        },
      },
    });
  }

  // --- Create GTA Cannabis Tenant ---
  const gtaTemplate = await prisma.template.findUnique({ where: { slug: 'gta-cannabis' } });
  if (gtaTemplate) {
    console.log('Creating GTA Cannabis tenant...');
    await prisma.tenant.upsert({
      where: { subdomain: 'gta' },
      update: { templateId: gtaTemplate.id },
      create: {
        businessName: 'GTA Cannabis Dispensary',
        subdomain: 'gta',
        isActive: true,
        templateId: gtaTemplate.id,
        settings: {
          logoUrl: '/gta-logo.png',
          contactEmail: 'sales@gtacannabis.ca',
          primaryColor: '#000000',
          secondaryColor: '#FFD700',
        },
      },
    });
  }

  // Create Super Admin
  console.log('Creating super admin...');

  const superAdminPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@budstack.to' },
    update: {},
    create: {
      email: 'admin@budstack.to',
      password: superAdminPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Super admin created:', superAdmin.email);

  // Create HealingBuds Tenant Admin
  console.log('Creating HealingBuds tenant admin...');

  const tenantAdminPassword = await bcrypt.hash('admin123', 10);

  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'admin@healingbuds.pt' },
    update: {},
    create: {
      email: 'admin@healingbuds.pt',
      password: tenantAdminPassword,
      name: 'HealingBuds Admin',
      role: 'TENANT_ADMIN',
      tenantId: healingBudsTenant.id,
    },
  });

  console.log('HealingBuds tenant admin created:', tenantAdmin.email);

  // Create Test User for HealingBuds
  console.log('Creating test user...');

  const testUserPassword = await bcrypt.hash('test123', 10);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@healingbuds.pt' },
    update: {},
    create: {
      email: 'test@healingbuds.pt',
      password: testUserPassword,
      name: 'Test Patient',
      role: 'PATIENT',
      tenantId: healingBudsTenant.id,
    },
  });

  console.log('Test user created:', testUser.email);

  // Create Products for HealingBuds
  console.log('Creating products for HealingBuds...');

  const products = [
    {
      name: 'CBD Oil 10%',
      slug: 'cbd-oil-10',
      description: 'Premium CBD oil with 10% concentration. Perfect for managing anxiety, pain, and sleep disorders. Lab-tested and certified.',
      price: 850.00, // ZAR (South African Rand)
      category: 'CBD Oil',
      thcContent: 0.2,
      cbdContent: 10.0,
      images: ['/products/cbd-oil-10.jpg'],
      stock: 50,
    },
    {
      name: 'CBD Oil 20%',
      slug: 'cbd-oil-20',
      description: 'High-potency CBD oil with 20% concentration. Ideal for chronic pain and severe anxiety management.',
      price: 1500.00,
      category: 'CBD Oil',
      thcContent: 0.2,
      cbdContent: 20.0,
      images: ['/products/cbd-oil-20.jpg'],
      stock: 35,
    },
    {
      name: 'THC:CBD 1:1 Oil',
      slug: 'thc-cbd-1-1-oil',
      description: 'Balanced THC:CBD oil ratio for comprehensive relief. Excellent for pain management and inflammation.',
      price: 1200.00,
      category: 'THC/CBD Oil',
      thcContent: 10.0,
      cbdContent: 10.0,
      images: ['/products/thc-cbd-oil.jpg'],
      stock: 40,
    },
    {
      name: 'Cannabis Flower - Indica',
      slug: 'cannabis-flower-indica',
      description: 'Premium indica strain. Relaxing effects perfect for evening use, sleep aid, and pain relief.',
      price: 250.00, // per gram
      category: 'Flower',
      strainType: "INDICA" as any,
      thcContent: 18.0,
      cbdContent: 1.0,
      images: ['/products/indica-flower.jpg'],
      stock: 100,
    },
    {
      name: 'Cannabis Flower - Sativa',
      slug: 'cannabis-flower-sativa',
      description: 'Energizing sativa strain. Great for daytime use, focus, and mood enhancement.',
      price: 250.00,
      category: 'Flower',
      strainType: "SATIVA" as any,
      thcContent: 20.0,
      cbdContent: 0.5,
      images: ['/products/sativa-flower.jpg'],
      stock: 80,
    },
    {
      name: 'Cannabis Flower - Hybrid',
      slug: 'cannabis-flower-hybrid',
      description: 'Balanced hybrid strain offering the best of both indica and sativa effects.',
      price: 250.00,
      category: 'Flower',
      strainType: "HYBRID" as any,
      thcContent: 16.0,
      cbdContent: 2.0,
      images: ['/products/hybrid-flower.jpg'],
      stock: 90,
    },
    {
      name: 'CBD Capsules 25mg',
      slug: 'cbd-capsules-25mg',
      description: 'Convenient CBD capsules, 25mg per capsule. Easy to dose and perfect for on-the-go relief.',
      price: 600.00, // per bottle of 30 capsules
      category: 'Capsules',
      thcContent: 0.0,
      cbdContent: 25.0,
      images: ['/products/cbd-capsules.jpg'],
      stock: 60,
    },
    {
      name: 'Full Spectrum Oil 15%',
      slug: 'full-spectrum-oil-15',
      description: 'Full spectrum cannabis oil containing multiple cannabinoids for enhanced entourage effect.',
      price: 1100.00,
      category: 'Full Spectrum Oil',
      thcContent: 5.0,
      cbdContent: 15.0,
      images: ['/products/full-spectrum-oil.jpg'],
      stock: 45,
    },
    {
      name: 'CBD Topical Cream',
      slug: 'cbd-topical-cream',
      description: 'CBD-infused topical cream for localized pain relief. Perfect for muscle aches and joint pain.',
      price: 450.00,
      category: 'Topicals',
      thcContent: 0.0,
      cbdContent: 5.0,
      images: ['/products/cbd-cream.jpg'],
      stock: 70,
    },
    {
      name: 'Sleep Support Tincture',
      slug: 'sleep-support-tincture',
      description: 'Specially formulated tincture with CBD and CBN for better sleep quality.',
      price: 950.00,
      category: 'Tinctures',
      thcContent: 0.5,
      cbdContent: 12.0,
      images: ['/products/sleep-tincture.jpg'],
      stock: 55,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: {
        slug_tenantId: {
          slug: product.slug,
          tenantId: healingBudsTenant.id,
        },
      },
      update: product,
      create: {
        ...product,
        tenantId: healingBudsTenant.id,
      },
    });
  }

  console.log(`Created ${products.length} products for HealingBuds`);

  console.log('Database seeded successfully!');
  console.log('\n=== Login Credentials ===');
  console.log('Super Admin:');
  console.log('  Email: admin@budstack.to');
  console.log('  Password: admin123');
  console.log('\nTenant Admin (HealingBuds):');
  console.log('  Email: admin@healingbuds.pt');
  console.log('  Password: admin123');
  console.log('\nTest User (HealingBuds):');
  console.log('  Email: test@healingbuds.pt');
  console.log('  Password: test123');
  console.log('========================\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCore()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
