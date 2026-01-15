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

async function seedOrgs() {
    console.log('🏢 Seeding Clerk Organizations...');

    const tenants = await prisma.tenants.findMany({
        include: {
            users: {
                where: { role: 'TENANT_ADMIN' }
            }
        }
    });

    console.log(`Found ${tenants.length} tenants in local database.`);

    for (const tenant of tenants) {
        try {
            console.log(`Processing Tenant: ${tenant.businessName} (${tenant.id})`);

            const slug = tenant.subdomain || `tenant-${tenant.id.substring(0, 8)}`;
            let orgId: string | null = null;
            let isNew = false;

            // Resolve Admin Clerk ID
            let adminClerkId: string | null = null;
            if (tenant.users.length > 0) {
                const adminEmail = tenant.users[0].email;
                const clerkUsers = await clerkClient.users.getUserList({ emailAddress: [adminEmail], limit: 1 });
                if (clerkUsers.data.length > 0) {
                    adminClerkId = clerkUsers.data[0].id;
                } else {
                    console.warn(`⚠️ Admin user ${adminEmail} not found in Clerk. Skipping Org creation/authorship.`);
                }
            }

            // Attempt to create org if we have an admin
            if (!orgId && adminClerkId) {
                try {
                    const org = await clerkClient.organizations.createOrganization({
                        name: tenant.businessName,
                        slug: slug,
                        publicMetadata: {
                            tenantId: tenant.id
                        },
                        createdBy: adminClerkId
                    });
                    orgId = org.id;
                    isNew = true;
                    console.log(`✅ Created Org: ${tenant.businessName} (${org.id})`);
                } catch (e: any) {
                    if (e.errors && e.errors[0]?.code === 'form_identifier_exists') {
                        console.log(`ℹ️ Org with slug ${slug} likely exists. Retrieving...`);

                        // Try to find it via the admin user's memberships
                        const memberships = await clerkClient.users.getOrganizationMembershipList({ userId: adminClerkId });
                        const match = memberships.data.find(m => m.organization.slug === slug);
                        if (match) {
                            orgId = match.organization.id;
                            console.log(`✅ Found existing Org ID from admin membership: ${orgId}`);
                        } else {
                            // Fallback: This might fail if the admin isn't in it, but we tried.
                            console.warn(`⚠️ Could not find Org ID for slug ${slug}.`);
                        }
                    } else {
                        console.error(`❌ Failed to create org:`, e);
                    }
                }
            }

            if (orgId) {
                // 2. Ensure Members
                for (const user of tenant.users) {
                    // Resolve Clerk ID for this user
                    const clerkUserList = await clerkClient.users.getUserList({ emailAddress: [user.email], limit: 1 });
                    const clerkUserId = clerkUserList.data[0]?.id;

                    if (!clerkUserId) {
                        console.warn(`⚠️ User ${user.email} not found in Clerk. Skipping membership.`);
                        continue;
                    }

                    console.log(`   Ensuring user ${user.email} (${clerkUserId}) is in Org...`);
                    try {
                        await clerkClient.organizations.createOrganizationMembership({
                            organizationId: orgId,
                            userId: clerkUserId,
                            role: 'org:admin'
                        });
                        console.log(`   ✅ Added ${user.email} as Admin`);
                    } catch (e: any) {
                        // Ignore if already member (resource_conflict or membership_exists)
                        if (e.errors && (e.errors[0]?.code === 'resource_conflict' || e.errors[0]?.code === 'membership_exists')) {
                            console.log(`   ℹ️ User already a member.`);
                        } else {
                            console.error(`   ❌ Failed to add member:`, e);
                        }
                    }
                }

                // 3. Update Org Metadata to be sure (if it was existing)
                if (!isNew) {
                    await clerkClient.organizations.updateOrganization(orgId, {
                        publicMetadata: { tenantId: tenant.id }
                    });
                    console.log(`   Synced metadata.`);
                }
            }

        } catch (error) {
            console.error(`❌ Error processing tenant ${tenant.id}:`, error);
        }
    }

    console.log('✨ Org seeding complete!');
}

seedOrgs()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
