
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = "gerard161+clerk@gmail.com";
    console.log(`Checking user with email: ${email}`);

    const users = await prisma.users.findMany({
        where: {
            email: {
                contains: "gerard161",
                mode: 'insensitive'
            }
        },
        include: {
            tenants: true
        }
    });

    console.log("Found Users:", JSON.stringify(users, null, 2));

    users.forEach(async (user: any) => {
        if (user.tenantId) {
            const tenant = await prisma.tenants.findUnique({
                where: { id: user.tenantId }
            });
            console.log(`User ${user.email} associated with tenant:`, tenant?.businessName);
        } else {
            console.log(`User ${user.email} has NO tenantId set.`);
        }
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
