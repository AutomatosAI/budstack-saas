"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Slim registration for SA ID-upload stores: account + shipping only, NO
 * medical consultation. Posts to /api/consultation/submit, which (for an
 * ID-upload tenant) creates the Dr Green client via verificationType "ID".
 * After the account is created the customer logs in and uploads their ID from
 * the dashboard ("Verify your identity" card).
 */
export function IdUploadRegistration({
  tenantSlug,
  basePath,
}: {
  tenantSlug: string;
  basePath: string;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password.length < 8)
      return setError("Password must be at least 8 characters.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/consultation/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          ...form,
          phoneCode: "+27",
          gender: "",
          country: "South Africa",
          countryCode: "ZA", // server maps ZA → ZAF for Dr Green shipping
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false)
        throw new Error(data?.error || "Registration failed. Please try again.");
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        className="mx-auto max-w-xl rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--tenant-color-surface, var(--tenant-color-background))",
          borderColor: "var(--tenant-color-border, rgba(0,0,0,0.15))",
        }}
      >
        <CheckCircle2
          className="mx-auto mb-4 h-12 w-12"
          style={{ color: "var(--tenant-color-primary)" }}
        />
        <h3
          className="mb-2 text-xl font-semibold"
          style={{ color: "var(--tenant-color-heading)" }}
        >
          Account created
        </h3>
        <p className="mb-6 text-sm" style={{ color: "var(--tenant-color-text)" }}>
          Next, log in and upload a valid ID from your dashboard to get verified.
          There&apos;s no medical consultation required.
        </p>
        <Link
          href={`${basePath}/login`}
          className="inline-block rounded-lg px-5 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--tenant-color-primary)" }}
        >
          Log in to continue
        </Link>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--tenant-color-background)",
    borderColor: "var(--tenant-color-border, rgba(0,0,0,0.2))",
    color: "var(--tenant-color-text)",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-xl space-y-4 rounded-2xl border p-6"
      style={{
        backgroundColor: "var(--tenant-color-surface, var(--tenant-color-background))",
        borderColor: "var(--tenant-color-border, rgba(0,0,0,0.15))",
      }}
    >
      <p className="text-sm" style={{ color: "var(--tenant-color-text)" }}>
        Create your account, then upload a valid ID to get verified — no medical
        consultation needed.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <input required placeholder="First name" value={form.firstName} onChange={set("firstName")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
        <input required placeholder="Last name" value={form.lastName} onChange={set("lastName")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      </div>
      <input required type="email" placeholder="Email" value={form.email} onChange={set("email")} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      <input required type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      <div className="grid grid-cols-2 gap-4">
        <input required placeholder="Phone (e.g. 821234567)" value={form.phoneNumber} onChange={set("phoneNumber")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
        <input required type="date" aria-label="Date of birth" value={form.dateOfBirth} onChange={set("dateOfBirth")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      </div>
      <input required placeholder="Street address" value={form.addressLine1} onChange={set("addressLine1")} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      <input placeholder="Apartment, suite (optional)" value={form.addressLine2} onChange={set("addressLine2")} className="w-full rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      <div className="grid grid-cols-3 gap-4">
        <input required placeholder="City" value={form.city} onChange={set("city")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
        <input required placeholder="Province" value={form.state} onChange={set("state")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
        <input required placeholder="Postal code" value={form.postalCode} onChange={set("postalCode")} className="rounded-lg border px-3 py-2 text-sm" style={inputStyle} />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--tenant-color-primary)" }}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
          </>
        ) : (
          "Create account"
        )}
      </button>
    </form>
  );
}
