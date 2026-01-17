
import { prisma } from "../lib/db";

async function main() {
    const email = "gerard161+buds@gmail.com";
    // Getting User ID first
    const user = await prisma.users.findUnique({
        where: { email }
    });

    if (!user) {
        console.log("User not found");
        return;
    }

    console.log(`Checking cart for User ID: ${user.id}`);

    const cart = await prisma.drgreen_carts.findFirst({
        where: { userId: user.id }
    });

    if (!cart) {
        console.log("No cart found for this user.");
    } else {
        console.log("Cart found:", JSON.stringify(cart, null, 2));
        if (Array.isArray(cart.items)) {
            console.log(`Item count: ${cart.items.length}`);
        } else {
            console.log("Items is not an array:", typeof cart.items);
        }
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
