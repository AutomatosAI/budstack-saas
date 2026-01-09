import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { newsArticles } from '../lib/data/newsArticles';

const prisma = new PrismaClient();

export async function seedPosts() {
    console.log('Starting migration of legacy articles...');

    const subdomain = 'healingbuds';
    const tenant = await prisma.tenants.findUnique({
        where: { subdomain },
        include: { users: true }
    });

    if (!tenant) {
        console.error(`Tenant '${subdomain}' not found.`);
        process.exit(1);
    }

    const author = tenant.users[0]; // Use first user (Admin)
    if (!author) {
        console.error('No users found for tenant.');
        process.exit(1);
    }

    console.log(`Found tenant: ${tenant.businessName}, Author: ${author.name}`);

    for (const article of newsArticles) {
        const htmlContent = Array.isArray(article.content)
            ? article.content.map(p => `<p>${p}</p>`).join('')
            : article.content;

        await prisma.posts.upsert({
            where: {
                slug_tenantId: {
                    slug: article.id,
                    tenantId: tenant.id
                }
            },
            update: {
                title: article.title,
                excerpt: article.description,
                content: htmlContent,
                coverImage: article.image,
                published: true,
            },
            create: {
                id: crypto.randomUUID(),
                updatedAt: new Date(),
                title: article.title,
                slug: article.id,
                excerpt: article.description,
                content: htmlContent,
                coverImage: article.image,
                published: true,
                tenantId: tenant.id,
                authorId: author.id,
            }
        });
        console.log(`Migrated: ${article.title}`);
    }

    console.log('Migration complete.');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedPosts()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
