'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu, X, ShoppingCart, ChevronDown, LogOut, Store, LayoutDashboard, Shield,
  FileText, Newspaper, ClipboardCheck, Leaf, Headphones, Users, Info, Heart,
  type LucideIcon,
} from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import { SectionProps } from '@/lib/types/section-props';
import { getTenantBasePath, prefixTenantHref } from '@/lib/tenant-utils';
import { useCartStore } from '@/lib/cart-store';
import { checkUserKycStatus, type KycStatus } from '@/app/actions/kyc-check';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * NavHealingBuds — Dark edge-to-edge navigation with Clerk auth, KYC badge & cart.
 *
 * Fully data-driven — all config from defaults.json / sectionConfig:
 *   navigation.links       → nav links array
 *   navigation.cta         → { label, href } primary CTA
 *   navigation.showCart     → boolean (default true)
 *   navigation.accentColor → active link color (default: CSS var --tenant-color-accent)
 *   navigation.bgColor     → header background (default: CSS var --tenant-color-primary)
 *   navigation.signedOutLabel → text for signed-out button (default "Connect")
 *
 * Logo comes from logoUrl prop (signed S3 URL from layout.tsx).
 * Colors come from CSS variables set by TenantThemeProvider.
 */
export function NavHealingBuds(props: SectionProps) {
  const { tenant, logoUrl, consultationUrl, navigation, sectionConfig } = props;

  const businessName = tenant.businessName;
  const basePath = getTenantBasePath(tenant.subdomain);
  const router = useRouter();
  const pathname = usePathname();

  // --- Config from defaults.json / sectionConfig ---
  const config = sectionConfig || navigation || {};
  const showCart = config.showCart !== false;
  const accentColor = config.accentColor || null; // falls back to CSS var
  const bgColor = config.bgColor || null; // falls back to CSS var
  const signedOutLabel = config.signedOutLabel || 'Connect';

  // --- Icon map for data-driven nav icons (icon name from defaults.json) ---
  const ICON_MAP: Record<string, LucideIcon> = {
    FileText, Newspaper, ClipboardCheck, Leaf, Headphones, Users, Info, Heart,
    Shield, Store, Menu,
  };

  // --- Links from defaults.json ---
  const defaultLinks = [
    { label: 'Products', href: '/products' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const prefixHref = (href: string) => prefixTenantHref(href, basePath);
  const rawLinks = config.links || navigation?.links || defaultLinks;
  const links = rawLinks.map((l: any) => ({ ...l, href: prefixHref(l.href) }));

  // --- CTA from defaults.json ---
  const ctaLabel = config.cta?.label || navigation?.cta?.label || 'Get Started';
  const ctaHref = prefixHref(
    config.cta?.href || navigation?.cta?.href || consultationUrl || '/consultation',
  );

  // --- Scroll state ---
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- Cart ---
  const totalItems = useCartStore((s) => s.getTotalItems());

  // --- Clerk auth ---
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const role = (user?.publicMetadata as any)?.role as string | undefined;

  // --- KYC status ---
  const [kyc, setKyc] = useState<KycStatus | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      checkUserKycStatus().then(setKyc).catch(() => {});
    } else if (isLoaded && !isSignedIn) {
      setKyc(null);
    }
  }, [isLoaded, isSignedIn]);

  const kycVerified = kyc?.kycVerified === true;

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/' });
  };

  // Truncate email for display
  const userEmail = user?.primaryEmailAddress?.emailAddress || '';
  const displayEmail = userEmail.length > 24 ? userEmail.slice(0, 22) + '...' : userEmail;
  const userInitial = user?.firstName?.[0] || userEmail[0]?.toUpperCase() || 'U';

  // Dynamic colors — use config overrides or CSS variables from TenantThemeProvider
  const navBg = bgColor || 'hsl(var(--tenant-color-primary, 178 48% 16%))';
  const navBgScrolled = bgColor || 'hsl(var(--tenant-color-primary, 178 48% 16%))';
  const activeColor = accentColor || 'hsl(var(--tenant-color-accent, 48 96% 53%))';

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? navBgScrolled : navBg,
        backdropFilter: scrolled ? 'blur(20px)' : 'blur(8px)',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-all duration-300"
        style={{ height: scrolled ? '60px' : '72px' }}
      >
        {/* Logo — from logoUrl prop (S3 signed URL) */}
        <Link href={basePath || '/'} className="flex items-center shrink-0">
          {logoUrl ? (
            <div
              className="relative transition-all duration-300"
              style={{
                width: scrolled ? '140px' : '180px',
                height: scrolled ? '35px' : '45px',
              }}
            >
              <Image
                src={logoUrl}
                alt={businessName}
                fill
                className="object-contain"
                priority
              />
            </div>
          ) : (
            <span
              className="font-bold text-white transition-all duration-300 uppercase tracking-wide"
              style={{
                fontFamily: 'var(--tenant-font-heading, sans-serif)',
                fontSize: scrolled ? '0.95rem' : '1.1rem',
              }}
            >
              {businessName}
            </span>
          )}
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-1">
          {links.map((link: { label: string; href: string; icon?: string }) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
            const IconComp = link.icon ? ICON_MAP[link.icon] : null;
            return (
              <Link
                key={link.href}
                href={link.href}
                data-active={isActive || undefined}
                className="relative text-xs font-medium transition-colors px-3 py-2 rounded-lg hover:bg-white/10 flex items-center gap-1.5"
                style={{
                  color: isActive ? activeColor : 'rgba(255,255,255,0.8)',
                }}
              >
                {IconComp && <IconComp size={14} />}
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Desktop Right Actions */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {/* Cart */}
          {showCart && (
            <Link
              href={`${basePath}/cart`}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart size={18} className="text-white/70" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold px-1">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
          )}

          {/* KYC Badge — only when signed in */}
          {isSignedIn && kyc && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: kycVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: kycVerified ? '#10B981' : '#F59E0B',
                border: `1px solid ${kycVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: kycVerified ? '#10B981' : '#F59E0B' }}
              />
              {kycVerified ? 'Verified' : 'Not Registered'}
            </div>
          )}

          {/* CTA — hidden for verified users */}
          {!kycVerified && (
            <Link
              href={ctaHref}
              data-nav-cta=""
              className="px-4 py-2 text-xs font-semibold rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
            >
              {ctaLabel}
            </Link>
          )}

          {/* Auth: User Dropdown or Connect button */}
          {!isLoaded ? (
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          ) : isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors outline-none">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold">
                    {userInitial}
                  </div>
                  <span className="text-xs text-white/80 max-w-[120px] truncate hidden xl:inline">
                    {displayEmail}
                  </span>
                  <ChevronDown size={14} className="text-white/50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  {role && (
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: role === 'SUPER_ADMIN' ? 'rgba(239,68,68,0.1)' : role === 'TENANT_ADMIN' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                        color: role === 'SUPER_ADMIN' ? '#EF4444' : role === 'TENANT_ADMIN' ? '#3B82F6' : '#10B981',
                      }}
                    >
                      {role === 'TENANT_ADMIN' ? 'Admin' : role?.replace('_', ' ') || 'Patient'}
                    </span>
                  )}
                </div>
                <DropdownMenuSeparator />
                {role === 'SUPER_ADMIN' && (
                  <DropdownMenuItem onClick={() => router.push('/super-admin')} className="cursor-pointer">
                    <Shield className="w-4 h-4 mr-2" />
                    Super Admin
                  </DropdownMenuItem>
                )}
                {(role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN') && (
                  <DropdownMenuItem onClick={() => router.push('/tenant-admin')} className="cursor-pointer">
                    <Store className="w-4 h-4 mr-2" />
                    Store Dashboard
                  </DropdownMenuItem>
                )}
                {(role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN') && <DropdownMenuSeparator />}
                <DropdownMenuItem onClick={() => router.push(`${basePath}/dashboard`)} className="cursor-pointer">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  My Account
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href={`${basePath}/login`}
              className="px-4 py-2 text-xs font-semibold rounded-full text-white transition-all hover:bg-white/10"
              style={{
                border: '1.5px solid rgba(255,255,255,0.4)',
              }}
            >
              {signedOutLabel}
            </Link>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          {showCart && (
            <Link
              href={`${basePath}/cart`}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart size={20} className="text-white/70" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-bold px-1">
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>
          )}
          <button
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X size={24} className="text-white" />
            ) : (
              <Menu size={24} className="text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="lg:hidden border-t"
          style={{
            backgroundColor: navBg,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {links.map((link: { label: string; href: string; icon?: string }) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + '/');
              const IconComp = link.icon ? ICON_MAP[link.icon] : null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-active={isActive || undefined}
                  className="flex items-center gap-2 text-base font-medium py-3 px-3 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ color: isActive ? activeColor : 'rgba(255,255,255,0.85)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {IconComp && <IconComp size={18} />}
                  {link.label}
                </Link>
              );
            })}

            {/* Mobile KYC badge */}
            {isSignedIn && kyc && (
              <div className="px-3 py-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: kycVerified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: kycVerified ? '#10B981' : '#F59E0B',
                    border: `1px solid ${kycVerified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: kycVerified ? '#10B981' : '#F59E0B' }}
                  />
                  {kycVerified ? 'Verified' : 'Not Registered'}
                </span>
              </div>
            )}

            <div className="pt-3 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              {!kycVerified && (
                <Link
                  href={ctaHref}
                  data-nav-cta=""
                  className="block text-center px-6 py-3 text-sm font-semibold text-white rounded-full bg-emerald-500 hover:bg-emerald-400 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {ctaLabel}
                </Link>
              )}

              {isSignedIn ? (
                <div className="space-y-1 pt-2">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-white">{user?.fullName || 'User'}</p>
                    <p className="text-xs text-white/60 truncate">{userEmail}</p>
                  </div>
                  {(role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN') && (
                    <Link
                      href="/tenant-admin"
                      className="block text-sm text-white/80 py-2 px-3 rounded-lg hover:bg-white/10 transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      Store Dashboard
                    </Link>
                  )}
                  <Link
                    href={`${basePath}/dashboard`}
                    className="block text-sm text-white/80 py-2 px-3 rounded-lg hover:bg-white/10 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    My Account
                  </Link>
                  <button
                    onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    className="w-full text-left text-sm text-red-400 py-2 px-3 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href={`${basePath}/login`}
                  className="block w-full text-center px-6 py-3 text-sm font-semibold text-white rounded-full transition-all"
                  style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {signedOutLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
