"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to send reset email");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Failed to send reset email. Please try again.");
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
            {submitted ? (
              <>
                <h1 className="font-bs-serif text-2xl font-medium text-bs-fg-0 mb-3">
                  Check your email
                </h1>
                <p className="text-bs-fg-2 mb-6">
                  If an account exists with{" "}
                  <strong className="text-bs-fg-0">{email}</strong>, you'll
                  receive password reset instructions shortly.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-bs-bg-2 text-bs-fg-1 border border-bs-border hover:bg-bs-bg-2/80 px-4 py-2.5 text-sm font-medium transition"
                >
                  Return to login
                </Link>
              </>
            ) : (
              <>
                <h1 className="font-bs-serif text-2xl font-medium text-bs-fg-0 mb-2">
                  Forgot password
                </h1>
                <p className="text-sm text-bs-fg-2 mb-6">
                  Enter your email address and we'll send you instructions to
                  reset your password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-[11px] font-bs-mono font-medium uppercase tracking-[0.14em] text-bs-fg-1"
                    >
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 rounded-xl border border-bs-border bg-bs-bg-2 px-4 text-bs-fg-0 placeholder:text-bs-fg-3 focus:border-bs-green-400 focus:ring-2 focus:ring-bs-green-400/30"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-bs-green-500 text-bs-bg-0 hover:bg-bs-green-400 font-medium rounded-xl shadow-[0_8px_24px_-8px_rgba(82,217,122,0.5)]"
                  >
                    {loading ? "Sending…" : "Send reset instructions"}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      href="/auth/login"
                      className="text-sm text-bs-green-300 hover:text-bs-green-400 font-medium"
                    >
                      Remember your password? Log in
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
