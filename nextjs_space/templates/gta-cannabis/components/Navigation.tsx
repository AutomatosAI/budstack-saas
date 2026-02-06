'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ShoppingCart, User } from 'lucide-react';
import { useUser, useClerk } from "@clerk/nextjs";
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CartDropdown } from '@/components/cart-dropdown';

interface NavigationProps {
  businessName: string;
  subdomain: string;
  logoUrl?: string | null;
}

export function Navigation({ businessName, subdomain, logoUrl }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: `/store/${subdomain}/conditions`, label: 'Conditions' },
    { href: `/store/${subdomain}/products`, label: 'Products' },
    { href: `/store/${subdomain}/the-wire`, label: 'The Wire' },
    { href: `/store/${subdomain}/about`, label: 'About' },
    { href: `/store/${subdomain}/blockchain`, label: 'Blockchain' },
    { href: `/store/${subdomain}/consultation`, label: 'Check Eligibility' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300`}
      style={{
        backgroundColor: isScrolled ? '#1A1A2E' : 'rgba(26, 26, 46, 0.9)',
        borderBottom: isScrolled ? '2px solid #FF6B9D' : 'none',
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href={`/store/${subdomain}`} className="flex items-center gap-3">
            {logoUrl && (
              <div className="relative w-10 h-10">
                <Image
                  src={logoUrl}
                  alt={`${businessName} logo`}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            )}
            <span
              className="text-xl font-bold"
              style={{
                color: '#FF6B9D',
                textShadow: '0 0 10px rgba(255, 107, 157, 0.5)',
                fontFamily: '"Press Start 2P", cursive',
              }}
            >
              {businessName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-all duration-200"
                style={{
                  color: pathname === link.href ? '#C3F0CA' : '#F5F5F5',
                  textShadow:
                    pathname === link.href
                      ? '0 0 10px rgba(195, 240, 202, 0.7)'
                      : 'none',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Cart */}
            <CartDropdown />

            {/* User Menu */}
            {isLoaded && isSignedIn ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-[#FF6B9D]"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <User className="w-5 h-5" />
                </Button>
                {isUserMenuOpen && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    {/* Dropdown Menu */}
                    <div
                      className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50"
                      style={{ backgroundColor: '#1A1A2E', border: '1px solid #FF6B9D' }}
                    >
                      <Link
                        href="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-white hover:bg-[#FF6B9D]/20 rounded-t-lg"
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut({ redirectUrl: `/store/${subdomain}` });
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#FF6B9D] hover:bg-[#FF6B9D]/20 rounded-b-lg"
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
                    backgroundColor: '#FF6B9D',
                    color: '#1A1A2E',
                    boxShadow: '0 0 20px rgba(255, 107, 157, 0.5)',
                  }}
                  className="hover:opacity-90 transition-opacity font-bold"
                >
                  Sign In
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:text-[#FF6B9D]"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden border-t"
          style={{ backgroundColor: '#1A1A2E', borderColor: '#FF6B9D' }}
        >
          <div className="container mx-auto px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium transition-colors"
                style={{
                  color: pathname === link.href ? '#C3F0CA' : '#F5F5F5',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
