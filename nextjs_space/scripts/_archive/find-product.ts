
import { prisma } from "../lib/db";

async function main() {
    const products = await prisma.products.findMany({
        where: {
            OR: [
                { name: { contains: "NFS", mode: "insensitive" } },
                { name: { contains: "BlockBerry", mode: "insensitive" } }
            ]
        }
    });

    console.log("Found products:", JSON.stringify(products, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
