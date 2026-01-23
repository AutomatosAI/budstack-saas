# Tenant ID Resolution Issue - Root Cause Analysis

## The Problem

**Error:** `Foreign key constraint violated on the constraint: tenant_templates_tenantId_fkey`

**Why it's happening:**
1. During onboarding, the code stores the **Clerk Organization ID** (e.g., `org_38evxeRP8KLqsmjZR8R5wvluths`) in `user.publicMetadata.tenantId`
2. The database `tenants` table uses **UUIDs** for tenant IDs (e.g., `3975b683-27c8-403a-bf16-9178a8589902`)
3. When code tries to use `user.tenantId` (Clerk Org ID) as a foreign key to `tenants.id` (UUID), PostgreSQL rejects it because the Clerk Org ID doesn't exist in the `tenants.id` column

## The Design Intent (Why It Was Done This Way)

Looking at `app/api/onboarding/route.ts` line 151:
```typescript
tenantId: clerkOrg.id // Mapping Clerk Org ID to our concept of Tenant ID
```

The comment suggests this was intentional - storing Clerk Org ID for "easier lookup". However, this creates a mismatch:
- **Clerk Org ID** is stored in user metadata
- **Database Tenant UUID** is what foreign keys expect
- The Clerk Org ID is also stored in `tenants.settings.clerkOrgId` for mapping

## Why It "Worked Before"

It likely worked before because:
1. Older tenants might have been created differently (before this Clerk Org mapping was added)
2. Or the code paths that use `user.tenantId` directly weren't hitting foreign key constraints
3. Or there was a migration/schema change that introduced the strict foreign key constraint

## The Fix Strategy

### Option 1: Resolve Tenant ID (Current Fix - Recommended)
Use a helper function to resolve Clerk Org ID → Database Tenant UUID before using it in foreign keys.

**Pros:**
- Minimal code changes
- Works with existing data
- Backward compatible

**Cons:**
- Requires a lookup query
- Slightly more complex

### Option 2: Store Database Tenant ID in Metadata (Better Long-term)
Change onboarding to store the actual database tenant UUID in `user.publicMetadata.tenantId` instead of Clerk Org ID.

**Pros:**
- Direct foreign key usage
- No lookup needed
- Simpler code

**Cons:**
- Requires updating existing users' metadata
- Migration needed

### Option 3: Use Clerk Organization Membership (Most Robust)
Use Clerk's organization membership API to get the org, then look up tenant by `settings.clerkOrgId`.

**Pros:**
- Uses Clerk's built-in org system properly
- Most reliable

**Cons:**
- More API calls
- More complex

## Recommended Plan

1. **Immediate Fix:** Use the `resolveTenantIdFromClerkOrg()` helper function (already implemented)
2. **Short-term:** Apply this resolution to all API routes that use `user.tenantId` for foreign keys
3. **Long-term:** Consider migrating to store database tenant UUID in metadata instead of Clerk Org ID

## Affected Routes

These routes use `user.tenantId` directly and may need the resolution:
- `/api/tenant-admin/templates/clone` ✅ (Fixed)
- `/api/tenant-admin/templates/[id]/activate`
- `/api/tenant-admin/tenant`
- `/api/tenant-admin/settings`
- `/api/tenant-admin/webhooks`
- `/api/tenant-admin/orders`
- And many more...

## Testing

To verify the fix:
1. Try cloning a template - should work now
2. Check logs for any remaining foreign key errors
3. Verify tenant lookup is working correctly
