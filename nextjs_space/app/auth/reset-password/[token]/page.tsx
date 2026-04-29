"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage({
  params,
}: {
  params: { token: string };
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 2000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="budstacks-theme min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 pt-24 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-bs-border bg-bs-bg-1 shadow-xl p-8">
            {success ? (
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-bs-green-400/15 border border-bs-green-400/30">
                  <CheckCircle2 className="h-6 w-6 text-bs-green-300" />
                </div>
                <h1 className="font-bs-serif text-2xl font-medium text-bs-fg-0 mb-2">
                  Password reset successful
                </h1>
                <p className="text-bs-fg-2">
                  Your password has been updated. Redirecting you to login…
                </p>
              </div>
            ) : (
              <>
                <h1 className="font-bs-serif text-2xl font-medium text-bs-fg-0 mb-2">
                  Reset your password
                </h1>
                <p className="text-sm text-bs-fg-2 mb-6">
                  Enter your new password below.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-[11px] font-bs-mono font-medium uppercase tracking-[0.14em] text-bs-fg-1"
                    >
                      New password
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bs-fg-3" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={8}
                        className="h-12 rounded-xl border border-bs-border bg-bs-bg-2 pl-10 pr-10 text-bs-fg-0 placeholder:text-bs-fg-3 focus:border-bs-green-400 focus:ring-2 focus:ring-bs-green-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-bs-fg-3 hover:text-bs-fg-1 transition"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-bs-fg-3">
                      Must be at least 8 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-[11px] font-bs-mono font-medium uppercase tracking-[0.14em] text-bs-fg-1"
                    >
                      Confirm new password
                    </Label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bs-fg-3" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        className="h-12 rounded-xl border border-bs-border bg-bs-bg-2 pl-10 pr-10 text-bs-fg-0 placeholder:text-bs-fg-3 focus:border-bs-green-400 focus:ring-2 focus:ring-bs-green-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-bs-fg-3 hover:text-bs-fg-1 transition"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-bs-green-500 text-bs-bg-0 hover:bg-bs-green-400 font-medium rounded-xl shadow-[0_8px_24px_-8px_rgba(82,217,122,0.5)]"
                  >
                    {loading ? "Resetting password…" : "Reset password"}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      href="/auth/login"
                      className="text-sm text-bs-green-300 hover:text-bs-green-400 font-medium"
                    >
                      Back to login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
