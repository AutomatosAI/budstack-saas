
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking recent tenants...");

    const tenants = await prisma.tenants.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            users: true
        }
    });

    console.log("Recent Tenants:", JSON.stringify(tenants, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
