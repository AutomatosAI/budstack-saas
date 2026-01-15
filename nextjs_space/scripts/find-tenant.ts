
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tenants = await prisma.tenants.findMany({
        where: {
            OR: [
                { businessName: { contains: 'Healingbuds', mode: 'insensitive' } },
                { businessName: { contains: 'Healing Buds', mode: 'insensitive' } },
                { subdomain: { contains: 'healingbuds', mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            businessName: true,
            subdomain: true
        }
    });

    console.log('Found Tenants:', JSON.stringify(tenants, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
