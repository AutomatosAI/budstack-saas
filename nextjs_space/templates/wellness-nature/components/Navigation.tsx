'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useClerk } from "@clerk/nextjs";
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ShoppingCart, User, Menu, X, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartDropdown } from '@/components/cart-dropdown';

interface NavigationProps {
  businessName: string;
  logoUrl?: string | null;
  tenant: any;
}

export default function Navigation({ businessName, logoUrl, tenant }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const slug = tenant?.subdomain || '';
  const baseUrl = `/store/${slug}`;

  // Check if we're on the homepage
  const isHomepage = pathname === baseUrl || pathname === `${baseUrl}/`;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationLinks = [
    { href: `${baseUrl}/conditions`, label: 'Conditions' },
    { href: `${baseUrl}/products`, label: 'Products' },
    { href: `${baseUrl}/the-wire`, label: 'The Wire' },
    { href: `${baseUrl}/about`, label: 'About' },
    { href: `${baseUrl}/blockchain`, label: 'Blockchain' },
    { href: `${baseUrl}/consultation`, label: 'Check Eligibility' },
  ];

  const handleSignOut = async () => {
    await signOut({ redirectUrl: '/' });
  };

  // Use the wellness logo from the template
  const finalLogoUrl = logoUrl || '/templates/wellness-nature/wellness-logo.png';

  // Determine header style
  // Dark header (brown bg, white text): homepage when not scrolled
  // Light header (white bg, dark text): everywhere else OR homepage when scrolled
  const shouldUseDarkHeader = isHomepage && !isScrolled;

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${shouldUseDarkHeader
          ? 'bg-[#3C2F24] shadow-md'
          : 'bg-[#F5F1E8]/95 backdrop-blur-md shadow-lg border-b border-[#3C2F24]/10'
          }`}
      >
        <nav className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Brand */}
            <Link href={baseUrl} className="flex items-center space-x-3 group">
              <div className="relative w-10 h-10">
                <Image
                  src={finalLogoUrl}
                  alt={businessName}
                  fill
                  className="object-contain transition-transform duration-300 group-hover:scale-110"
                  priority
                />
              </div>
              <span
                className={`font-heading text-xl font-semibold transition-colors ${shouldUseDarkHeader ? 'text-white' : 'text-gray-900'
                  }`}
                style={{ fontFamily: 'var(--tenant-font-heading, "Lora", serif)' }}
              >
                {businessName}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors relative group ${shouldUseDarkHeader
                    ? 'text-white hover:text-[#D4E8B8]'
                    : 'text-gray-700 hover:text-[#6B8E23]'
                    }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-0 w-0 h-0.5 transition-all duration-300 group-hover:w-full ${shouldUseDarkHeader ? 'bg-white' : 'bg-[#6B8E23]'
                      }`}
                  />
                </Link>
              ))}
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center space-x-4">
              {/* Cart */}
              <CartDropdown />

              {/* User Menu */}
              {isLoaded && isSignedIn ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`p-2 rounded-full transition-colors ${shouldUseDarkHeader
                      ? 'hover:bg-white/10 text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                      }`}
                  >
                    <User className="w-5 h-5" />
                  </button>

                  {/* User Dropdown */}
                  {isUserMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      {/* Menu */}
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50 border border-gray-100">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                        </div>
                        <Link
                          href="/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Dashboard
                        </Link>
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            handleSignOut();
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link href="/auth/login">
                  <Button
                    size="sm"
                    style={{
                      backgroundColor: shouldUseDarkHeader ? 'transparent' : '#6B8E23',
                      color: '#ffffff',
                      borderColor: '#ffffff',
                      borderWidth: shouldUseDarkHeader ? '2px' : '0',
                    }}
                    className="hover:opacity-90 transition-opacity"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${shouldUseDarkHeader
                ? 'hover:bg-white/10 text-white'
                : 'hover:bg-gray-100 text-gray-700'
                }`}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden mt-4 pt-4 border-t border-white/10"
            >
              <div className="space-y-2">
                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-4 py-2 rounded-lg transition-colors ${shouldUseDarkHeader
                      ? 'text-white hover:bg-white/10'
                      : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {link.label}
                  </Link>
                ))}
                {isLoaded && isSignedIn ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-4 py-2 rounded-lg transition-colors ${shouldUseDarkHeader
                        ? 'text-white hover:bg-white/10'
                        : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="block w-full text-left px-4 py-2 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-4 py-2 rounded-lg transition-colors ${shouldUseDarkHeader
                      ? 'text-white hover:bg-white/10'
                      : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </nav>
      </motion.header>

      {/* Spacer to prevent content from hiding under fixed header */}
      <div className="h-20" />
    </>
  );
}
