
import { prisma } from "../lib/db";

async function main() {
    const targetId = "89fd2352-2e68-450c-8d45-2d48ad1ad368"; // The verified questionnaire ID
    const newEmail = "gerard161+buds@gmail.com"; // Lowercase email

    console.log(`Updating questionnaire ${targetId}...`);

    const updated = await prisma.consultation_questionnaires.update({
        where: { id: targetId },
        data: { email: newEmail }
    });

    console.log("Updated record:", updated.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
