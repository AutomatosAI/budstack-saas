
import { prisma } from "../lib/db";

async function main() {
    const email = process.env.POPULATE_CART_EMAIL;

    if (!email) {
        console.error("ERROR: POPULATE_CART_EMAIL environment variable is required");
        process.exit(1);
    }

    const user = await prisma.users.findUnique({
        where: { email }
    });

    if (!user || !user.tenantId) {
        console.log("User or tenant not found");
        return;
    }

    console.log(`Populating cart with user's requested items...`);

    // Using specific items from user's screenshot
    // Target Total: 560. Shipping is 5. Subtotal should be 555.
    // 3 items * 185 = 555.
    const mockItems = [
        {
            strainId: "mock_nfs_12",
            quantity: 1,
            size: 1,
            strain: {
                id: "mock_nfs_12",
                name: "NFS 12",
                retailPrice: 185.0,
                imageUrl: "mock_url"
            }
        },
        {
            strainId: "mock_blockberry",
            quantity: 2,
            size: 1,
            strain: {
                id: "mock_blockberry",
                name: "BlockBerry",
                retailPrice: 185.0,
                imageUrl: "mock_url"
            }
        }
    ];

    const cart = await prisma.drgreen_carts.upsert({
        where: {
            userId_tenantId: {
                userId: user.id,
                tenantId: user.tenantId
            }
        },
        update: {
            items: mockItems,
            drGreenCartId: "MOCK_CART_ID_USER_SPECIFIC",
            updatedAt: new Date()
        },
        create: {
            id: "manual_cart_" + Date.now(),
            userId: user.id,
            tenantId: user.tenantId,
            items: mockItems,
            drGreenCartId: "MOCK_CART_ID_USER_SPECIFIC",
            updatedAt: new Date()
        }
    });

    console.log("Cart updated with specific items:", JSON.stringify(cart, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
