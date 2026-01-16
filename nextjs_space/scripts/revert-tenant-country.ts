
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenantId = 'cmk3yimox0000l0u8wyy8y297';
    console.log(`🌍 Reverting country for tenant: ${tenantId} to SA...`);

    const updated = await prisma.tenants.update({
        where: { id: tenantId },
        data: { countryCode: 'SA' } // Explicitly setting to SA as requested
    });

    console.log(`✅ Updated Tenant Country: ${updated.countryCode}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
