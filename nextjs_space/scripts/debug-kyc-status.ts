
import { prisma } from "../lib/db";

async function main() {
    const email = process.env.DEBUG_EMAIL;

    if (!email) {
        console.error("ERROR: DEBUG_EMAIL environment variable is required");
        process.exit(1);
    }

    console.log(`Checking user: ${email}`);

    const user = await prisma.users.findFirst({
        where: { email }
    });

    console.log("User found:", user ? "YES" : "NO");
    if (user) {
        console.log("User ID:", user.id);
        console.log("User Email:", user.email);
    }

    const questionnaires = await prisma.consultation_questionnaires.findMany({
        where: { email }
    });

    console.log(`Found ${questionnaires.length} questionnaires for this email.`);

    questionnaires.forEach((q, i) => {
        console.log(`[${i}] ID: ${q.id}`);
        console.log(`    Created At: ${q.createdAt}`);
        console.log(`    Is Verified: ${q.isKycVerified} (Type: ${typeof q.isKycVerified})`);
        console.log(`    DrGreen Client ID: ${q.drGreenClientId}`);
    });

    // Test the exact query used in the route
    const localQuestionnaire = await prisma.consultation_questionnaires.findFirst({
        where: {
            AND: [
                { email: email },
                { isKycVerified: true }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log("Query Result (localQuestionnaire):", localQuestionnaire ? "FOUND" : "NOT FOUND");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
