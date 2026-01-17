
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const tenant = await prisma.tenants.findFirst({
        where: { subdomain: "healingbuds" }
    });

    if (tenant) {
        console.log(`Tenant: ${tenant.businessName}`);
        console.log(`Subdomain: ${tenant.subdomain}`);
        console.log(`Country Code: '${tenant.countryCode}'`);
    } else {
        console.log("Tenant not found");
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
