import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Syncing Template Database Slugs...');

    // Update the lovable template record to the new 'healingbuds' name
    const result = await prisma.templates.updateMany({
        where: { slug: 'lovable-template-1764245125103' },
        data: {
            id: 'healingbuds',
            slug: 'healingbuds',
            name: 'Healing Buds'
        }
    });

    if (result.count > 0) {
        console.log(`✅ Updated ${result.count} template record(s) to 'healingbuds'`);
    } else {
        // Fallback: Check if it exists with another name or needs creation
        const existing = await prisma.templates.findUnique({
            where: { slug: 'healingbuds' }
        });

        if (existing) {
            console.log('✨ Template "healingbuds" already exists in database.');
        } else {
            console.log('📝 Creating new "healingbuds" template record...');
            await prisma.templates.create({
                data: {
                    id: 'healingbuds',
                    slug: 'healingbuds',
                    name: 'Healing Buds',
                    category: 'medical',
                    updatedAt: new Date()
                }
            });
            console.log('✅ Created "healingbuds" template record.');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
