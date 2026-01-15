"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  User,
  LogOut,
  Settings,
  Calendar,
  Stethoscope,
  Shield,
} from "lucide-react";
import { CartDropdown } from "./cart-dropdown";
// import { LanguageSwitcher } from './language-switcher';
import { useLanguage } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tenant } from "@/types/client";

interface NavigationProps {
  tenant?: Tenant | null;
  logoUrl?: string | null;
}

export function Navigation({ tenant, logoUrl }: NavigationProps = {}) {
  // Get tenant settings with defaults
  const tenantSettings = (tenant?.settings as any) || {};
  const brandName = tenant?.businessName || "HealingBuds";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Use dark logo when scrolled (white background), white logo when at top (transparent/dark background)
  const defaultLogo = isScrolled ? "/hb-logo-dark.png" : "/hb-logo-white.png";
  const finalLogoUrl = logoUrl || defaultLogo;

  // Extract template colors with fallbacks
  const primaryColor = tenantSettings.primaryColor || "#059669";
  const secondaryColor = tenantSettings.secondaryColor || "#10b981";

  const { language, t } = useLanguage();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const status = isLoaded ? (isSignedIn ? "authenticated" : "unauthenticated") : "loading";
  const pathname = usePathname();
  const router = useRouter();

  // Detect if we're in a tenant store
  const storeMatch = pathname.match(/^\/store\/([^\/]+)/);
  const tenantSlug = storeMatch ? storeMatch[1] : "healingbuds";
  const baseStorePath = `/store/${tenantSlug}`;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navigationItems = [
    { href: baseStorePath, label: t("nav.home") },
    { href: `${baseStorePath}/about`, label: t("nav.about") },
    { href: `${baseStorePath}/how-it-works`, label: t("nav.howItWorks") },
    { href: `${baseStorePath}/products`, label: t("nav.products") },
    { href: `${baseStorePath}/consultation`, label: t("nav.consultation") },
    { href: `${baseStorePath}/contact`, label: t("nav.contact") },
  ];

  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/" });
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled
        ? "bg-white/95 backdrop-blur-md shadow-lg border-b"
        : "bg-transparent"
        }`}
      style={
        isScrolled ? { borderBottomColor: `${primaryColor}20` } : undefined
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link
            href={baseStorePath || "/"}
            className="flex items-center space-x-3 hover:opacity-90 transition-opacity"
          >
            <div className="relative w-48 h-12">
              <Image
                src={finalLogoUrl}
                alt={`${brandName} Logo`}
                fill
                className="object-contain"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${pathname === item.href
                  ? "border-b-2"
                  : isScrolled
                    ? "text-gray-700"
                    : "text-gray-800"
                  }`}
                style={
                  pathname === item.href
                    ? { color: primaryColor, borderBottomColor: primaryColor }
                    : { color: isScrolled ? "#374151" : "#1f2937" }
                }
                onMouseEnter={(e) => {
                  if (pathname !== item.href) {
                    e.currentTarget.style.color = primaryColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (pathname !== item.href) {
                    e.currentTarget.style.color = isScrolled
                      ? "#374151"
                      : "#1f2937";
                  }
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Shopping Cart */}
            <CartDropdown />

            {/* Language Switcher */}
            {/* <LanguageSwitcher /> */}

            {/* Authentication */}
            {status === "loading" ? (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            ) : isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {user?.firstName?.[0] ||
                        user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                    {/* Verification badge removed for now or check user.publicMetadata.isVerified */}
                    {/* {user?.publicMetadata?.isVerified && (
                      <Badge
                        className="absolute -top-1 -right-1 w-4 h-4 p-0 text-white"
                        style={{ backgroundColor: secondaryColor }}
                      >
                        ✓
                      </Badge>
                    )} */}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">
                      {user?.fullName || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  {((user?.publicMetadata?.role === "TENANT_ADMIN" ||
                    user?.publicMetadata?.role === "SUPER_ADMIN")) && (
                      <>
                        <DropdownMenuItem
                          onClick={() => router.push("/tenant-admin")}
                          className="cursor-pointer"
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Tenant Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard")}
                    className="cursor-pointer"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/consultations")}
                    className="cursor-pointer"
                  >
                    <Stethoscope className="w-4 h-4 mr-2" />
                    Consultations
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/settings")}
                    className="cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-red-600"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/auth/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-700"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = primaryColor;
                      e.currentTarget.style.backgroundColor = `${primaryColor}10`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#374151";
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {t("nav.login")}
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button
                    size="sm"
                    className="text-white shadow-lg hover:shadow-xl"
                    style={{ backgroundColor: primaryColor }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    {t("nav.signup")}
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t"
              style={{ borderTopColor: `${primaryColor}20` }}
            >
              <div className="px-2 pt-2 pb-3 space-y-1">
                {navigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block px-3 py-2 text-base font-medium rounded-md transition-colors"
                    style={
                      pathname === item.href
                        ? {
                          backgroundColor: `${primaryColor}10`,
                          color: primaryColor,
                        }
                        : { color: "#374151" }
                    }
                    onMouseEnter={(e) => {
                      if (pathname !== item.href) {
                        e.currentTarget.style.backgroundColor = "#f9fafb";
                        e.currentTarget.style.color = primaryColor;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (pathname !== item.href) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#374151";
                      }
                    }}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="pt-4 pb-2 border-t border-gray-200">
                  <div className="px-3">{/* <LanguageSwitcher /> */}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
