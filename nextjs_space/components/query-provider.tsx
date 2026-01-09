'use client';

/**
 * React Query Provider for client-side data fetching and caching
 *
 * Cache configuration:
 * - Dashboard stats: 5 minutes stale time (infrequent updates)
 * - List data (tenants, products, orders): 1 minute stale time (more frequent)
 * - Mutations automatically invalidate related queries
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Global defaults
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
