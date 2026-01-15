
import { prisma } from '../lib/db';
import { hash } from 'bcryptjs';

async function main() {
    const email = 'admin@healingbuds.co';
    const password = await hash('admin123', 12);

    // Find the tenant first
    const tenant = await prisma.tenants.findUnique({
        where: { subdomain: 'healingbuds' }
    });

    if (!tenant) {
        console.error('HealingBuds tenant not found!');
        process.exit(1);
    }

    // Create or update the user
    const user = await prisma.users.upsert({
        where: { email },
        update: {
            tenantId: tenant.id,
            role: 'TENANT_ADMIN',
            isActive: true, // Ensure active
        },
        create: {
            email,
            name: 'HealingBuds Admin (CO)',
            password,
            role: 'TENANT_ADMIN',
            tenantId: tenant.id,
            isActive: true,
            id: `user_${Math.random().toString(36).substring(2, 15)}`,
            updatedAt: new Date(),
        }
    });

    console.log(`User ${user.email} upserted and linked to tenant ${tenant.businessName}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
