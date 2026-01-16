
import { prisma } from "../lib/db";

async function main() {
    const email = "gerard161+buds@gmail.com";
    // Clerk ID found in previous run
    const clerkId = "user_38LZAya9dQyyb1qL0GFGzZIEufp";

    console.log(`Checking user: ${email} / ${clerkId}`);

    // 1. Check User
    const user = await prisma.users.findUnique({
        where: { id: clerkId }
    });
    console.log("User found by ID:", user ? "YES" : "NO");
    if (user) {
        console.log(`User stored email: ${user.email}`);
    }

    // 2. Check Questionnaires by Email
    const byEmail = await prisma.consultation_questionnaires.findMany({
        where: { email: email }
    });
    console.log(`Found ${byEmail.length} questionnaires by EMAIL.`);

    // 3. Check Questionnaires by UserID
    /* Note: schema might use 'userId' or relationship. Let's inspect fields */
    // Looking at previous output, there isn't a userId column explicitly listed in the SELECT query?
    // Wait, let's look at schema first. I'll just try to find all and print a few to see structure.

    const all = await prisma.consultation_questionnaires.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${all.length} total questionnaires in DB.`);

    all.forEach((q: any) => {
        console.log(`--- Q ID: ${q.id} ---`);
        console.log(`  Email: ${q.email}`);
        console.log(`  TenantId: ${q.tenantId}`);
        // Check if there is a userId field or relationship
        console.log(`  User Link: ${JSON.stringify(q)}`);
    });

    // If we find one that looks like it belongs to Gerard, we can fix it.
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
