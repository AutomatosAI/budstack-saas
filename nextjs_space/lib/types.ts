// Multi-Tenant Types

export type UserType = "customer" | "tenant" | "admin";

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  customDomain: string | null;
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
  logo: string | null;
  logoWhite: string | null;
  subscriptionTier: string;
  country: string;
  currency: string;
  language: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  tenantId?: string;
  role?: string;
}

// ============================================
// COMPREHENSIVE TENANT BRANDING & THEMING
// ============================================
//
// PRD-208: `TenantSettings` is now DERIVED from the Zod `tenantSettingsSchema`
// (the runtime source of truth) in `lib/tenant-settings.ts`. Re-exported here so
// existing `import { TenantSettings } from "@/lib/types"` sites keep working.
// Read `tenants.settings` ONLY via `parseTenantSettings` (parse-on-read), never
// `as any` — see `lib/tenant-settings.ts`.

export type { TenantSettings } from "@/lib/tenant-settings";
