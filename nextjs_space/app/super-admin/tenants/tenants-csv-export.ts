import { format } from "date-fns";
import { exportToCSV } from "@/lib/admin/csv-export";
import type { Tenant } from "./tenants-table-helpers";

const TENANT_CSV_HEADERS = [
  { key: "businessName" as const, label: "Business Name" },
  { key: "nftTokenId" as const, label: "NFT Token ID" },
  { key: "subdomain" as const, label: "Subdomain" },
  { key: "customDomain" as const, label: "Custom Domain" },
  { key: "isActive" as const, label: "Status" },
  { key: "users" as const, label: "Users" },
  { key: "products" as const, label: "Products" },
  { key: "orders" as const, label: "Orders" },
  { key: "createdAt" as const, label: "Created" },
];

function buildTenantRows(tenants: Tenant[]) {
  return tenants.map((t) => ({
    businessName: t.businessName,
    nftTokenId: t.nftTokenId || "",
    subdomain: t.subdomain,
    customDomain: t.customDomain || "",
    isActive: t.isActive ? "Active" : "Inactive",
    users: t._count.users,
    products: t._count.products,
    orders: t._count.orders,
    createdAt: format(new Date(t.createdAt), "yyyy-MM-dd"),
  }));
}

/**
 * Export the given tenants to a CSV file. No-op when the list is empty.
 */
export async function exportTenantsToCSV(
  tenants: Tenant[],
  onSuccess: (recordCount: number, fileSize: string) => void,
  onError: (error: Error) => void,
) {
  if (tenants.length === 0) return;

  await exportToCSV(
    buildTenantRows(tenants),
    TENANT_CSV_HEADERS,
    "tenants",
    undefined,
    onSuccess,
    onError,
  );
}
