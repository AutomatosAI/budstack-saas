
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodeCrypto = require('crypto');

async function main() {
    const email = "gerard161+clerk@gmail.com";
    const tenantId = "1ae9473f-318d-4c5b-9f1c-e43caf7986cd";
    const businessName = "clerk";

    console.log(`Restoring missing user: ${email} for tenant: ${tenantId}`);

    // Check if user already exists (just in case)
    const existing = await prisma.users.findUnique({
        where: { email }
    });

    if (existing) {
        console.log("User already exists! Updating tenantId...");
        await prisma.users.update({
            where: { email },
            data: { tenantId }
        });
    } else {
        console.log("Creating new user record...");
        await prisma.users.create({
            data: {
                id: nodeCrypto.randomUUID(),
                email,
                password: "CLERK_MANAGED_ACCOUNT",
                name: businessName,
                role: "TENANT_ADMIN",
                tenantId: tenantId,
                updatedAt: new Date(),
            }
        });
    }

    console.log("Done. User should now be able to access the dashboard.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
