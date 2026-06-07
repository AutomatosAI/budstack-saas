export const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

/** Filter type for tenant status */
export type TenantStatusFilter = "all" | "active" | "inactive";

/** Typed filters for tenant table - uses Record index signature for URL state compatibility */
export type TenantFilters = {
  status: TenantStatusFilter;
} & Record<string, string>;

/**
 * Tenant data shape from Prisma query
 */
export interface Tenant {
  id: string;
  businessName: string;
  subdomain: string;
  customDomain: string | null;
  nftTokenId: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: {
    users: number;
    products: number;
    orders: number;
  };
}

export interface TenantsTableProps {
  /** Array of tenant data from server (paginated and filtered) */
  tenants: Tenant[];
  /** Total count of filtered tenants (for pagination) */
  totalCount: number;
  /** Count of active tenants (with search applied) */
  activeCount: number;
  /** Count of inactive tenants (with search applied) */
  inactiveCount: number;
}

/** Type for confirmation dialog action */
export type BulkActionType = "activate" | "deactivate" | null;
