
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClerkClient } from '@clerk/backend';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});

const USERS_TO_SEED = [
    {
        email: 'admin@budstack.io',
        password: 'admin123',
        firstName: 'Super',
        lastName: 'Admin',
        publicMetadata: {
            role: 'SUPER_ADMIN',
        },
    },
    {
        email: 'admin@healingbuds.pt',
        password: 'admin123',
        firstName: 'HealingBuds',
        lastName: 'Admin',
        publicMetadata: {
            role: 'TENANT_ADMIN',
            tenantId: 'cmk3yimox0000l0u8wyy8y297', // HealingBuds Portugal ID
        },
    },
];

async function seedUsers() {
    console.log('🌱 Seeding Clerk Users...');

    for (const user of USERS_TO_SEED) {
        try {
            console.log(`Processing ${user.email}...`);

            // Check if user exists
            const userList = await clerkClient.users.getUserList({
                emailAddress: [user.email],
            });

            if (userList.data.length > 0) {
                console.log(`User ${user.email} already exists. Updating metadata...`);
                const existingUser = userList.data[0];

                await clerkClient.users.updateUser(existingUser.id, {
                    publicMetadata: user.publicMetadata,
                });
                console.log(`✅ Updated metadata for ${user.email}`);
            } else {
                console.log(`Creating user ${user.email}...`);
                await clerkClient.users.createUser({
                    emailAddress: [user.email],
                    password: user.password,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    publicMetadata: user.publicMetadata,
                    skipPasswordChecks: true, // For dev/test convenience
                    skipPasswordRequirement: false,
                });
                console.log(`✅ Created user ${user.email}`);
            }

            // Sync with local database
            console.log(`Syncing ${user.email} with local database...`);

            // Fetch the user from Clerk to get the ID
            const clerkUserList = await clerkClient.users.getUserList({
                emailAddress: [user.email],
            });

            if (clerkUserList.data.length > 0) {
                const clerkUser = clerkUserList.data[0];

                // Find existing user by email
                const existingUser = await prisma.users.findFirst({
                    where: { email: user.email },
                    select: { id: true }
                });

                if (existingUser) {
                    if (existingUser.id !== clerkUser.id) {
                        console.log(`User ${user.email} exists with old ID ${existingUser.id}. Migrating to Clerk ID ${clerkUser.id}...`);
                        try {
                            // Update ID directly
                            await prisma.users.update({
                                where: { id: existingUser.id },
                                data: {
                                    id: clerkUser.id,
                                    role: user.publicMetadata.role as any,
                                    tenantId: user.publicMetadata.tenantId as string | null,
                                    updatedAt: new Date(),
                                },
                            });
                            console.log(`✅ Migrated ${user.email} to Clerk ID`);
                        } catch (e) {
                            console.error(`❌ Failed to migrate user ID for ${user.email}.`, e);
                        }
                    } else {
                        // Just update fields
                        await prisma.users.update({
                            where: { id: existingUser.id },
                            data: {
                                role: user.publicMetadata.role as any,
                                tenantId: user.publicMetadata.tenantId as string | null,
                                updatedAt: new Date(),
                            }
                        })
                        console.log(`✅ Updated existing user ${user.email}`);
                    }
                } else {
                    // Create new
                    await prisma.users.create({
                        data: {
                            id: clerkUser.id,
                            email: user.email,
                            password: 'hashed-password-placeholder-managed-by-clerk',
                            role: user.publicMetadata.role as any,
                            tenantId: user.publicMetadata.tenantId as string | null,
                            updatedAt: new Date(),
                        },
                    });
                    console.log(`✅ Created local user ${user.email}`);
                }
            }
        } catch (error) {
            console.error(`❌ Failed to process ${user.email}:`, error);
        }
    }

    console.log('✨ Seeding complete!');
}

seedUsers()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
