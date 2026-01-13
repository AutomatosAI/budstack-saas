"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
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
  ArrowRight,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";

interface TenantSettings {
  businessName: string;
  primaryColor: string;
  logoUrl?: string;
  subdomain?: string;
}

function LoginForm() {
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({
    businessName: "BudStack",
    primaryColor: "#16a34a",
  });

  useEffect(() => {
    // Get tenant from hostname/subdomain
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    const subdomain = parts.length >= 2 ? parts[0] : null;

    // Fetch tenant settings based on subdomain
    if (subdomain && subdomain !== "localhost" && subdomain !== "www") {
      fetch(`/api/tenant/${subdomain}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.tenant) {
            setTenantSettings({
              businessName: data.tenant.businessName || "BudStack",
              primaryColor: data.tenant.branding?.primaryColor || "#16a34a",
              logoUrl: data.tenant.branding?.logoUrl,
              subdomain: data.tenant.subdomain,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch tenant settings:", err);
        });
    } else {
      // Fallback to platform settings for non-tenant domains
      fetch("/api/super-admin/platform-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setTenantSettings({
              businessName: data.businessName || "BudStack",
              primaryColor: data.primaryColor || "#16a34a",
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

  // Check for messages from signup or other redirects
  const message = searchParams?.get("message");
  const error = searchParams?.get("error");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
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

        // Get fresh session and redirect based on role
        const session = await getSession();
        if (session?.user) {
          const userRole = (session.user as any).role;

          // Redirect based on user role
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <div className="flex items-center justify-center space-x-2 mb-4">
                {tenantSettings.logoUrl ? (
                  <div className="relative w-10 h-10">
                    <Image
                      src={tenantSettings.logoUrl}
                      alt={`${tenantSettings.businessName} Logo`}
                      fill
                      className="object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: tenantSettings.primaryColor }}
                  >
                    <Store className="w-6 h-6 text-white" />
                  </div>
                )}
                <span
                  className="text-2xl font-bold font-serif"
                  style={{ color: tenantSettings.primaryColor }}
                >
                  {tenantSettings.businessName}
                </span>
              </div>
            </Link>
            <h2 className="text-3xl font-bold text-gray-900 font-serif">
              Welcome Back
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to access your account
            </p>
          </div>

          {/* Messages */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"
            >
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800">{message}</p>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
            >
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">
                  {error === "CredentialsSignin"
                    ? "Invalid email or password"
                    : "An error occurred during sign in"}
                </p>
              </div>
            </motion.div>
          )}

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full mb-6 bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
            onClick={handleGoogleSignIn}
          >
            <Chrome className="w-4 h-4 mr-2" />
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or sign in with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={`pl-10 ${errors.email ? "border-red-500" : ""}`}
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
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`pl-10 pr-10 ${errors.password ? "border-red-500" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                />
                <Label htmlFor="rememberMe" className="text-sm text-gray-700">
                  Remember me
                </Label>
              </div>
              <Link
                href="/auth/forgot-password"
                className="text-sm hover:opacity-80 transition-opacity"
                style={{ color: tenantSettings.primaryColor }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              className="w-full text-white shadow-lg hover:shadow-xl transition-all duration-300"
              style={{ backgroundColor: tenantSettings.primaryColor }}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                href="/auth/signup"
                className="font-medium hover:opacity-80 transition-opacity"
                style={{ color: tenantSettings.primaryColor }}
              >
                Create one now
              </Link>
            </p>
          </div>
        </div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>GDPR Compliant</span>
            </div>
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>INFARMED Regulated</span>
            </div>
            <div className="flex items-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>SSL Encrypted</span>
            </div>
          </div>

          {/* Back to home */}
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-800"
            >
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Back to Homepage
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
