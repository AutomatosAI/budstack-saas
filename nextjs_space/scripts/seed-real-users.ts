
import { prisma } from '../lib/db';
import { hash } from 'bcryptjs';

async function main() {
    const tenantEmail = 'gerard@automatos.app';
    const superEmail = 'gerard161@gmail.com';
    const password = await hash('admin123', 12);

    // 1. Find the tenant for the Tenant Admin
    const tenant = await prisma.tenants.findUnique({
        where: { subdomain: 'healingbuds' }
    });

    if (!tenant) {
        console.error('HealingBuds tenant not found!');
        process.exit(1);
    }

    // 2. Upsert Tenant Admin
    const tenantAdmin = await prisma.users.upsert({
        where: { email: tenantEmail },
        update: {
            tenantId: tenant.id,
            role: 'TENANT_ADMIN',
            isActive: true,
        },
        create: {
            email: tenantEmail,
            name: 'Gerard Tenant Admin',
            password,
            role: 'TENANT_ADMIN',
            tenantId: tenant.id,
            isActive: true,
            id: `user_${Math.random().toString(36).substring(2, 15)}`,
            updatedAt: new Date(),
        }
    });

    console.log(`Tenant Admin ${tenantAdmin.email} upserted and linked to ${tenant.businessName}`);

    // 3. Upsert Super Admin
    const superAdmin = await prisma.users.upsert({
        where: { email: superEmail },
        update: {
            role: 'SUPER_ADMIN',
            isActive: true,
            tenantId: null // Super admin usually doesn't have a specific tenant or can access all
        },
        create: {
            email: superEmail,
            name: 'Gerard Super Admin',
            password,
            role: 'SUPER_ADMIN',
            tenantId: null,
            isActive: true,
            id: `user_${Math.random().toString(36).substring(2, 15)}`,
            updatedAt: new Date(),
        }
    });

    console.log(`Super Admin ${superAdmin.email} upserted.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
