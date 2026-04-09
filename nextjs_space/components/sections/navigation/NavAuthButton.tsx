'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LogOut, Store, LayoutDashboard, Shield, UserCircle, ChevronDown,
} from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface NavAuthButtonProps {
  basePath: string;
  /** 'dark' = white text / glass style (NavDark, NavPill etc), 'light' = themed CSS vars */
  variant: 'dark' | 'light';
  /** 'button' = text pill, 'icon' = UserCircle icon */
  loginStyle?: 'button' | 'icon';
  /** Label for signed-out button (default: "Login") */
  signedOutLabel?: string;
}

export function NavAuthButton({
  basePath,
  variant,
  loginStyle = 'button',
  signedOutLabel = 'Login',
}: NavAuthButtonProps) {
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRole((user.publicMetadata?.role as string) || null);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push(`${basePath}/login`);
  };

  const userInitial = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || '?';
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress || '';

  const isDark = variant === 'dark';

  // --- Signed in: avatar + dropdown ---
  if (isLoaded && isSignedIn) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors outline-none"
            style={{
              ...(isDark
                ? { color: 'white' }
                : { color: 'hsl(var(--tenant-color-text))' }),
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'hsl(var(--tenant-color-primary))',
                color: 'white',
              }}
            >
              {userInitial}
            </div>
            <ChevronDown
              size={14}
              style={{ opacity: 0.5, color: isDark ? 'white' : 'hsl(var(--tenant-color-text))' }}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
            {role && (
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor:
                    role === 'SUPER_ADMIN' ? 'rgba(239,68,68,0.1)'
                    : role === 'TENANT_ADMIN' ? 'rgba(59,130,246,0.1)'
                    : 'rgba(16,185,129,0.1)',
                  color:
                    role === 'SUPER_ADMIN' ? '#EF4444'
                    : role === 'TENANT_ADMIN' ? '#3B82F6'
                    : '#10B981',
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
    );
  }

  // --- Signed out: button or icon ---
  if (loginStyle === 'icon') {
    return (
      <Link
        href={`${basePath}/login`}
        className="p-2 rounded-lg transition-colors"
        aria-label="Login"
        style={{
          color: isDark ? 'rgba(255,255,255,0.7)' : 'hsl(var(--tenant-color-text))',
        }}
      >
        <UserCircle size={22} />
      </Link>
    );
  }

  // Default: button style
  if (isDark) {
    return (
      <Link
        href={`${basePath}/login`}
        className="px-4 py-2 text-xs font-semibold rounded-full text-white transition-all hover:bg-white/10"
        style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}
      >
        {signedOutLabel}
      </Link>
    );
  }

  return (
    <Link
      href={`${basePath}/login`}
      className="px-4 py-2 text-xs font-semibold rounded-full transition-all hover:opacity-90"
      style={{
        backgroundColor: 'hsl(var(--tenant-color-primary))',
        color: 'white',
      }}
    >
      {signedOutLabel}
    </Link>
  );
}
