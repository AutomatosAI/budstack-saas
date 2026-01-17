'use client';

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, ChevronDown, Globe, ShoppingCart, User, LogOut, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useUser, useClerk } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface NavigationProps {
  businessName: string;
  logoUrl?: string | null;
  tenant: any;
}

export default function Navigation({ businessName, logoUrl, tenant }: NavigationProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [whatWeDoOpen, setWhatWeDoOpen] = useState(false);
  const [aboutUsOpen, setAboutUsOpen] = useState(false);

  const whatWeDoRef = useRef<HTMLDivElement>(null);
  const aboutUsRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (whatWeDoRef.current && !whatWeDoRef.current.contains(target)) {
        setWhatWeDoOpen(false);
      }
      if (aboutUsRef.current && !aboutUsRef.current.contains(target)) {
        setAboutUsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const defaultLogoUrl = "/templates/healingbuds/hb-logo-white-new.png";
  const finalLogoUrl = logoUrl || defaultLogoUrl;

  const isWhatWeDoActive = false;
  const isAboutUsActive = false;

  return (
    <>
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 sm:top-2 sm:left-2 sm:right-2 h-1 bg-primary/20 z-[60] sm:rounded-t-xl">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-secondary to-primary origin-left"
          style={{
            scaleX,
            transformOrigin: "0%"
          }}
        />
      </div>

      <header
        className={cn(
          "fixed top-0 left-0 right-0 sm:top-2 sm:left-2 sm:right-2 z-50 backdrop-blur-xl rounded-none sm:rounded-xl transition-all duration-500 ease-out border-b sm:border",
          scrolled
            ? "shadow-2xl border-white/20 sm:scale-[0.99]"
            : "shadow-sm border-white/10"
        )}
        style={{
          backgroundColor: scrolled ? 'rgba(42, 61, 58, 0.98)' : 'rgba(42, 61, 58, 0.95)',
          transition: 'background-color 0.5s ease-out, transform 0.5s ease-out'
        }}
      >
        <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className={cn(
            "flex items-center justify-between transition-all duration-500 ease-out",
            scrolled ? "h-20 md:h-22" : "h-24 md:h-28"
          )}>
            <Link href={`/store/${tenant.subdomain}`} className="flex items-center flex-shrink-0 group">
              <Image
                src={finalLogoUrl}
                alt={`${businessName} Logo`}
                width={200}
                height={80}
                className={cn(
                  "w-auto object-contain transition-all duration-500 ease-out group-hover:scale-105",
                  scrolled ? "h-12 sm:h-14 md:h-16" : "h-14 sm:h-16 md:h-20"
                )}
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className={cn(
              "hidden lg:flex items-center flex-1 justify-end transition-all duration-500 ease-out",
              scrolled ? "gap-0.5 xl:gap-1 2xl:gap-2" : "gap-1 xl:gap-2 2xl:gap-3"
            )}>
              <Link
                href={`/store/${tenant.subdomain}/conditions`}
                className={cn(
                  "font-body font-semibold transition-all duration-300 ease-out rounded-lg hover:scale-105 whitespace-nowrap",
                  scrolled ? "text-xs 2xl:text-sm px-3 py-2" : "text-sm 2xl:text-base px-4 py-2.5",
                  "text-white/90 hover:text-white hover:bg-white/10"
                )}
              >
                Conditions
              </Link>

              <Link
                href={`/store/${tenant.subdomain}/products`}
                className={cn(
                  "font-body font-semibold transition-all duration-300 ease-out rounded-lg hover:scale-105 whitespace-nowrap",
                  scrolled ? "text-xs 2xl:text-sm px-3 py-2" : "text-sm 2xl:text-base px-4 py-2.5",
                  "text-white/90 hover:text-white hover:bg-white/10"
                )}
              >
                Products
              </Link>

              <Link
                href={`/store/${tenant.subdomain}/the-wire`}
                className={cn(
                  "font-body font-semibold transition-all duration-300 ease-out rounded-lg hover:scale-105 whitespace-nowrap",
                  scrolled ? "text-xs 2xl:text-sm px-3 py-2" : "text-sm 2xl:text-base px-4 py-2.5",
                  "text-white/90 hover:text-white hover:bg-white/10"
                )}
              >
                The Wire
              </Link>

              {/* About Us Dropdown */}
              <div
                ref={aboutUsRef}
                className="relative group"
                onMouseEnter={() => setAboutUsOpen(true)}
                onMouseLeave={() => setAboutUsOpen(false)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAboutUsOpen(!aboutUsOpen);
                  }}
                  className={cn(
                    "font-body flex items-center gap-1.5 font-semibold transition-all duration-300 ease-out relative rounded-lg hover:scale-105 whitespace-nowrap cursor-pointer select-none",
                    scrolled ? "text-xs 2xl:text-sm px-3 py-2" : "text-sm 2xl:text-base px-4 py-2.5",
                    isAboutUsActive
                      ? "text-white bg-white/20"
                      : "text-white/90 hover:text-white hover:bg-white/10"
                  )}
                >
                  About Us
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-150 pointer-events-none", aboutUsOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {aboutUsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-72 bg-card rounded-xl shadow-card border border-border/40 overflow-hidden z-[100]"
                    >
                      <Link
                        href={`/store/${tenant.subdomain}/about`}
                        className="block px-4 py-3 text-card-foreground hover:bg-muted transition-colors border-b border-border"
                        onClick={() => setAboutUsOpen(false)}
                      >
                        <div className="font-medium">About</div>
                        <div className="text-sm text-muted-foreground">Our story</div>
                      </Link>
                      <Link
                        href={`/store/${tenant.subdomain}/blockchain`}
                        className="block px-4 py-3 text-card-foreground hover:bg-muted transition-colors"
                        onClick={() => setAboutUsOpen(false)}
                      >
                        <div className="font-medium">Blockchain</div>
                        <div className="text-sm text-muted-foreground">Traceability</div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Language Switcher Icon */}
              <button
                className={cn(
                  "p-2 rounded-lg transition-all duration-300 hover:scale-105",
                  "text-white/90 hover:text-white hover:bg-white/10"
                )}
                aria-label="Switch language"
              >
                <Globe className="w-5 h-5" />
              </button>

              {/* Desktop Action Buttons */}
              {/* Desktop Action Buttons */}
              <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                {/* Check Eligibility Button (Restored) */}
                <Link
                  href={`/store/${tenant.subdomain}/consultation`}
                  className={cn(
                    "font-body font-bold px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl relative z-10 whitespace-nowrap",
                    "bg-white/95 text-[#2A3D3A] hover:bg-white",
                    "border-2 border-white shadow-lg",
                    "text-xs 2xl:text-sm"
                  )}
                >
                  <span className="hidden 2xl:inline">Check Eligibility</span>
                  <span className="2xl:hidden">Eligibility</span>
                </Link>

                {/* Cart Icon */}
                <Link
                  href={`/store/${tenant.subdomain}/cart`}
                  className={cn(
                    "p-2 rounded-full transition-all duration-300 hover:scale-105 hover:bg-white/10 text-white relative",
                  )}
                  aria-label="Shopping Cart"
                >
                  <ShoppingCart className="w-6 h-6" />
                  {/* Optional: Add badge here if cart has items */}
                </Link>

                {/* Profile Icon / Dropdown */}
                {isSignedIn ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        "p-2 rounded-full transition-all duration-300 hover:scale-105 hover:bg-white/10 text-white relative outline-none focus:outline-none",
                      )}>
                        {user?.imageUrl ? (
                          <div className="relative h-8 w-8 rounded-full overflow-hidden border-2 border-white/20">
                            <Image
                              src={user.imageUrl}
                              alt={user.fullName || 'Profile'}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <User className="w-6 h-6" />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 z-[100]" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{user?.fullName || 'User'}</p>
                          <p className="text-xs leading-none text-muted-foreground">
                            {user?.primaryEmailAddress?.emailAddress}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={`/store/${tenant.subdomain}/dashboard`} className="cursor-pointer">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          <span>Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => signOut({ redirectUrl: `/store/${tenant.subdomain}` })}
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link
                    href={`/store/${tenant.subdomain}/login`}
                    className={cn(
                      "p-2 rounded-full transition-all duration-300 hover:scale-105 hover:bg-white/10 text-white border-2 border-white/20",
                    )}
                    aria-label="Sign In"
                  >
                    <User className="w-6 h-6" />
                  </Link>
                )}
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed top-24 left-0 right-0 z-40 lg:hidden shadow-xl border-b border-white/10 overflow-y-auto max-h-[calc(100vh-6rem)]"
            style={{ backgroundColor: 'rgba(42, 61, 58, 0.98)' }}
          >
            <div className="container mx-auto px-4 py-6 space-y-4">
              <Link
                href={`/store/${tenant.subdomain}/about`}
                className="block py-3 text-white hover:text-white/80 transition-colors font-body font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                About Us
              </Link>
              <Link
                href={`/store/${tenant.subdomain}/conditions`}
                className="block py-3 text-white hover:text-white/80 transition-colors font-body font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                Conditions
              </Link>
              <Link
                href={`/store/${tenant.subdomain}/products`}
                className="block py-3 text-white hover:text-white/80 transition-colors font-body font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                Products
              </Link>
              <Link
                href={`/store/${tenant.subdomain}/the-wire`}
                className="block py-3 text-white hover:text-white/80 transition-colors font-body font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                The Wire
              </Link>
              <Link
                href={`/store/${tenant.subdomain}/about`}
                className="block py-3 text-white hover:text-white/80 transition-colors font-body font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                About Us
              </Link>
              <Link
                href={`/store/${tenant.subdomain}/contact`}
                className="block py-3 text-white hover:text-white/80 transition-colors font-body font-semibold"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <div className="pt-4 space-y-3">
                <Link
                  href={`/store/${tenant.subdomain}/consultation`}
                  className="block w-full py-3 px-4 text-center rounded-full bg-white/95 text-[#2A3D3A] font-body font-bold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Check Eligibility
                </Link>

                <Link
                  href={`/store/${tenant.subdomain}/cart`}
                  className="block w-full py-3 px-4 text-center rounded-full bg-white/10 text-white hover:bg-white/20 font-body font-bold border border-white/20"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    <span>Shopping Cart</span>
                  </div>
                </Link>

                {isSignedIn ? (
                  <>
                    <Link
                      href={`/store/${tenant.subdomain}/profile`}
                      className="block w-full py-3 px-4 text-center rounded-full bg-primary text-white font-body font-bold"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <LayoutDashboard className="w-5 h-5" />
                        <span>Dashboard</span>
                      </div>
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        signOut({ redirectUrl: `/store/${tenant.subdomain}` });
                      }}
                      className="block w-full py-3 px-4 text-center rounded-full border-2 border-red-500/50 text-red-400 font-body font-bold hover:bg-red-500/10"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                      </div>
                    </button>
                  </>
                ) : (
                  <Link
                    href={`/store/${tenant.subdomain}/login`}
                    className="block w-full py-3 px-4 text-center rounded-full border-2 border-white/60 text-white font-body font-bold"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Patient Login
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
