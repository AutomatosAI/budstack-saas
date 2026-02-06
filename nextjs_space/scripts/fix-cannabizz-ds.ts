import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the cannabizz tenant template
  const tenant = await prisma.tenants.findUnique({
    where: { subdomain: 'cannabizz' },
    include: { activeTenantTemplate: true },
  });

  if (!tenant?.activeTenantTemplate) {
    console.log('No active template for cannabizz');
    return;
  }

  const tt = tenant.activeTenantTemplate;
  console.log('Current designSystem:', JSON.stringify(tt.designSystem, null, 2));

  // Null out the corrupted designSystem so the template's :root CSS vars take effect
  await prisma.tenant_templates.update({
    where: { id: tt.id },
    data: { designSystem: {} },
  });

  console.log('Cleared designSystem for cannabizz tenant template');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
