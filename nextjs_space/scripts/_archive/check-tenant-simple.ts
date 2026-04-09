import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const subdomain = process.argv[2];
    if (!subdomain) {
        console.error('Please provide a subdomain');
        process.exit(1);
    }

    console.log(`Checking for tenant with subdomain: ${subdomain}...`);

    const tenant = await prisma.tenants.findUnique({
        where: { subdomain },
    });

    if (tenant) {
        console.log(`✅ Tenant found: ${tenant.businessName} (${tenant.id})`);
        console.log(`   Subdomain: ${tenant.subdomain}`);
        console.log(`   Custom Domain: ${tenant.customDomain || 'None'}`);
    } else {
        console.log(`❌ Tenant NOT found with subdomain: ${subdomain}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
