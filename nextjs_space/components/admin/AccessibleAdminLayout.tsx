'use client';

import { usePathname } from 'next/navigation';
import { SkipToContent } from './SkipToContent';

/**
 * AccessibleAdminLayout Component
 *
 * Wraps admin panel content with accessibility features:
 * - Skip-to-content link
 * - Main content wrapper with proper ARIA attributes
 * - Theme-specific focus states
 *
 * @param children - Admin panel content
 * @param theme - 'super-admin' or 'tenant-admin'
 */

export interface AccessibleAdminLayoutProps {
  children: React.ReactNode;
  theme: 'super-admin' | 'tenant-admin';
}

export function AccessibleAdminLayout({
  children,
  theme,
}: AccessibleAdminLayoutProps) {
  const pathname = usePathname();

  // Determine page title from pathname for screen readers
  const pageTitle = pathname
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Dashboard';

  return (
    <>
      {/* Skip to content link - hidden until focused */}
      <SkipToContent theme={theme} targetId="main-content" />

      {/* Main content wrapper with proper ARIA attributes */}
      <main
        id="main-content"
        role="main"
        aria-label={`${pageTitle} - ${theme === 'super-admin' ? 'Super Admin' : 'Tenant Admin'} Panel`}
        tabIndex={-1}
        className="focus:outline-none"
      >
        {children}
      </main>
    </>
  );
}
