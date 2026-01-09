/**
 * React Query hooks for analytics data with caching
 *
 * Cache configuration:
 * - Analytics data: 5 minutes stale time (dashboard stats update infrequently)
 * - Automatically refetches on mount if stale
 */

import { useQuery } from '@tanstack/react-query';

interface TenantAnalyticsData {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  recentOrders: number;
  recentCustomers: number;
  recentRevenue: number;
  avgOrderValue: number;
  revenueByDay: { date: string; revenue: number }[];
  ordersByDay: { date: string; orders: number }[];
  topProducts: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    orders: number;
  }[];
  customerGrowth: { date: string; customers: number }[];
  ordersByStatus: { name: string; value: number }[];
}

interface SuperAdminAnalyticsData {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  platformRevenue: number;
  tenantsByCountry: { country: string; count: number }[];
  recentSignups: { date: string; count: number }[];
}

/**
 * Hook for fetching tenant admin analytics data
 *
 * @param timeRange - Time range for analytics ('7d' | '30d' | '90d')
 * @returns React Query result with analytics data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTenantAnalytics('30d');
 * ```
 */
export function useTenantAnalytics(timeRange: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['tenant-analytics', timeRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/tenant-admin/analytics?timeRange=${timeRange}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch tenant analytics');
      }
      return response.json() as Promise<TenantAnalyticsData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for fetching super admin analytics data
 *
 * @param timeRange - Time range for analytics ('7d' | '30d' | '90d')
 * @returns React Query result with platform analytics data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSuperAdminAnalytics('30d');
 * ```
 */
export function useSuperAdminAnalytics(
  timeRange: '7d' | '30d' | '90d' = '30d'
) {
  return useQuery({
    queryKey: ['super-admin-analytics', timeRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/super-admin/analytics?timeRange=${timeRange}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch super admin analytics');
      }
      return response.json() as Promise<SuperAdminAnalyticsData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export type { TenantAnalyticsData, SuperAdminAnalyticsData };
