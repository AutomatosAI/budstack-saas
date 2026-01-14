"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  CheckCircle,
  AlertCircle,
  Chrome,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

interface TenantSettings {
  businessName: string;
  primaryColor: string;
  logoUrl?: string;
  subdomain?: string;
}

function LoginForm() {
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({
    businessName: "Popcorn Media",
    primaryColor: "#FF9500",
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    const subdomain = parts.length >= 2 ? parts[0] : null;

    if (subdomain && subdomain !== "localhost" && subdomain !== "www") {
      fetch(`/api/tenant/${subdomain}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.tenant) {
            setTenantSettings({
              businessName: data.tenant.businessName || "Popcorn Media",
              primaryColor: data.tenant.branding?.primaryColor || "#FF9500",
              logoUrl: data.tenant.branding?.logoUrl,
              subdomain: data.tenant.subdomain,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch tenant settings:", err);
        });
    } else {
      fetch("/api/super-admin/platform-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setTenantSettings({
              businessName: data.businessName || "Popcorn Media",
              primaryColor: data.primaryColor || "#FF9500",
              logoUrl: data.logoUrl,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch platform settings:", err);
        });
    }
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const message = searchParams?.get("message");
  const error = searchParams?.get("error");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      if (result?.error) {
        throw new Error("Invalid email or password");
      }
      if (result?.ok) {
        toast.success("Signed in successfully!");
        const session = await getSession();
        if (session?.user) {
          const userRole = (session.user as any).role;
          if (userRole === "SUPER_ADMIN") {
            router.replace("/super-admin");
          } else if (userRole === "TENANT_ADMIN") {
            router.replace("/tenant-admin");
          } else {
            router.replace("/dashboard");
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred during sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      toast.error("Google sign in failed");
    }
  };

  return (
    <div className="min-h-screen canvas-bg flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="card-floating p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <Link href="/" className="inline-block">
                <div className="flex items-center justify-center gap-3 mb-6">
                  {tenantSettings.logoUrl ? (
                    <div className="relative w-12 h-12">
                      <Image
                        src={tenantSettings.logoUrl}
                        alt={`${tenantSettings.businessName} Logo`}
                        fill
                        className="object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: tenantSettings.primaryColor }}
                    >
                      <Store className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <span className="font-display text-2xl font-bold text-foreground">
                    {tenantSettings.businessName}
                  </span>
                </div>
              </Link>
              <h1 className="font-display text-3xl font-bold text-foreground">
                Welcome Back
              </h1>
              <p className="mt-2 text-muted-foreground">
                Sign in to access your account
              </p>
            </div>

            {/* Messages */}
            {message && (
              <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm text-emerald-800">{message}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <p className="text-sm text-red-800">
                    {error === "CredentialsSignin"
                      ? "Invalid email or password"
                      : "An error occurred during sign in"}
                  </p>
                </div>
              </div>
            )}

            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              className="w-full mb-6 rounded-xl h-12 border-slate-200 bg-white hover:bg-slate-50"
              onClick={handleGoogleSignIn}
            >
              <Chrome className="w-5 h-5 mr-2" />
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-muted-foreground">
                  Or sign in with email
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-foreground">
                  Email Address
                </Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={`pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 ${errors.email ? "border-red-500" : ""
                      }`}
                    placeholder="joao@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`pl-10 pr-10 h-12 rounded-xl bg-slate-50 border-slate-200 ${errors.password ? "border-red-500" : ""
                      }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember me and forgot password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked as boolean)
                    }
                  />
                  <Label htmlFor="rememberMe" className="text-sm text-muted-foreground">
                    Remember me
                  </Label>
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Signing In...
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Sign up link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/auth/signup" className="text-accent hover:underline font-medium">
                  Create one now
                </Link>
              </p>
            </div>
          </div>

          {/* Trust indicators */}
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                <span>INFARMED Regulated</span>
              </div>
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen canvas-bg flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-accent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
