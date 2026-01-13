/**
 * React Query hooks for admin list data with caching
 *
 * Cache configuration:
 * - List data: 1 minute stale time (more frequent updates than analytics)
 * - Mutations automatically invalidate related queries
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============================================================================
// Types
// ============================================================================

interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface Tenant {
  id: string;
  businessName: string;
  subdomain: string;
  isActive: boolean;
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

// ============================================================================
// Tenants (Super Admin)
// ============================================================================

/**
 * Hook for fetching tenants list with pagination and filtering
 *
 * @param params - Pagination and filter parameters
 * @returns React Query result with tenants data
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useTenants({ page: 1, pageSize: 20, search: 'healing' });
 * ```
 */
export function useTenants(params: PaginationParams = {}) {
  return useQuery({
    queryKey: ["tenants", params],
    queryFn: async () => {
      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [key, String(value)]),
      ).toString();

      const response = await fetch(`/api/super-admin/tenants?${queryString}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tenants");
      }
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation hook for bulk tenant actions
 *
 * @returns Mutation function and state
 *
 * @example
 * ```tsx
 * const bulkAction = useTenantBulkAction();
 * bulkAction.mutate({ action: 'activate', tenantIds: ['id1', 'id2'] });
 * ```
 */
export function useTenantBulkAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      tenantIds,
    }: {
      action: "activate" | "deactivate";
      tenantIds: string[];
    }) => {
      const response = await fetch("/api/super-admin/tenants/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, tenantIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Bulk action failed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate tenants queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

// ============================================================================
// Products (Tenant Admin)
// ============================================================================

/**
 * Hook for fetching products list with pagination and filtering
 *
 * @param params - Pagination and filter parameters
 * @returns React Query result with products data
 */
export function useProducts(params: PaginationParams = {}) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [key, String(value)]),
      ).toString();

      const response = await fetch(`/api/tenant-admin/products?${queryString}`);
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation hook for bulk product actions
 */
export function useProductBulkAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      productIds,
    }: {
      action: "set-in-stock" | "set-out-of-stock" | "delete";
      productIds: string[];
    }) => {
      const response = await fetch("/api/tenant-admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, productIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Bulk action failed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate products and analytics queries
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-analytics"] });
    },
  });
}

// ============================================================================
// Orders (Tenant Admin)
// ============================================================================

/**
 * Hook for fetching orders list with pagination and filtering
 *
 * @param params - Pagination and filter parameters
 * @returns React Query result with orders data
 */
export function useOrders(params: PaginationParams = {}) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: async () => {
      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== "")
          .map(([key, value]) => [key, String(value)]),
      ).toString();

      const response = await fetch(`/api/tenant-admin/orders?${queryString}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation hook for bulk order actions
 */
export function useOrderBulkAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      orderIds,
    }: {
      action: "mark-processing" | "mark-completed";
      orderIds: string[];
    }) => {
      const response = await fetch("/api/tenant-admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Bulk action failed");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate orders and analytics queries
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-analytics"] });
    },
  });
}

// Export types
export type { Tenant, Product, Order, PaginationParams };
