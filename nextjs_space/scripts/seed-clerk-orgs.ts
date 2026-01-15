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

            // 1. Check if Org Exists (by slug or external ID mechanism... let's try searching or assume slug logic)
            // Clerk Org Slugs must be unique. Let's try to find an org by slug matching the subdomain.
            // Note: Backend API normally doesn't have "getOrgBySlug" easily exposed in all versions, 
            // but let's try to CREATE and handle "already exists" error, or just list user's memberships to infer?
            // Actually, we can list all organizations if not too many, or just try to create.

            const slug = tenant.subdomain || `tenant-${tenant.id.substring(0, 8)}`;
            let orgId: string | null = null;
            let isNew = false;

            // Attempt to create
            try {
                const org = await clerkClient.organizations.createOrganization({
                    name: tenant.businessName,
                    slug: slug,
                    publicMetadata: {
                        tenantId: tenant.id
                    },
                    createdBy: tenant.users[0]?.id // If we have an admin, make them creator. 
                    // Requires that user to exist in Clerk already.
                });
                orgId = org.id;
                isNew = true;
                console.log(`✅ Created Org: ${tenant.businessName} (${org.id})`);
            } catch (e: any) {
                if (e.errors && e.errors[0]?.code === 'form_identifier_exists') {
                    console.log(`ℹ️ Org with slug ${slug} likely exists. Retrieving...`);
                    // Sadly, retrieving by slug isn't a direct method in all SDK versions efficiently without listing.
                    // But we can try to update it? Or we can just skip if we assume it's set up.
                    // Ideally we want to get the ID.
                    // For now, let's assume we might need to list orgs to find it if we can't get it by error.
                    // IF the error gives us the ID, valid. If not, we might scan. 
                    // BUT, let's try to just find the admin user and list their orgs?

                    if (tenant.users.length > 0) {
                        const adminId = tenant.users[0].id;
                        const memberships = await clerkClient.users.getOrganizationMembershipList({ userId: adminId });
                        const match = memberships.data.find(m => m.organization.slug === slug);
                        if (match) {
                            orgId = match.organization.id;
                            console.log(`✅ Found existing Org ID from admin membership: ${orgId}`);
                        } else {
                            console.warn(`⚠️ Could not find Org ID for slug ${slug} even though it exists. User ${adminId} is not a member?`);
                            // We might need to manually list all orgs (expensive) or just fail this one.
                            // For this script, let's list all (limit 100) as fallback.
                            const allOrgs = await clerkClient.organizations.getOrganizationList({ limit: 100 });
                            const found = allOrgs.data.find(o => o.slug === slug);
                            if (found) {
                                orgId = found.id;
                                console.log(`✅ Found Org ID from list: ${orgId}`);
                            }
                        }
                    }
                } else {
                    console.error(`❌ Failed to create org:`, e);
                }
            }

            if (orgId) {
                // 2. Ensure Members
                for (const user of tenant.users) {
                    console.log(`   Ensuring user ${user.email} (${user.id}) is in Org...`);
                    try {
                        await clerkClient.organizations.createOrganizationMembership({
                            organizationId: orgId,
                            userId: user.id,
                            role: 'org:admin'
                        });
                        console.log(`   ✅ Added ${user.email} as Admin`);
                    } catch (e: any) {
                        // Ignore if already member
                        if (e.errors && e.errors[0]?.code === 'resource_conflict') {
                            console.log(`   ℹ️ User already a member.`);
                        } else {
                            console.error(`   ❌ Failed to add member:`, e);
                        }
                    }
                }

                // 3. Update Org Metadata to be sure
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
