"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { User, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface TenantData {
  id: string;
  businessName: string;
  subdomain: string;
  customDomain: string | null;
  countryCode: string;
  businessAddress1: string | null;
  businessAddress2: string | null;
  businessCity: string | null;
  businessState: string | null;
  businessPostalCode: string | null;
  businessCountry: string | null;
}

export default function TenantProfilePage() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    fetch("/api/tenant-admin/tenant")
      .then((res) => res.json())
      .then((data: TenantData) => {
        setTenant(data);
        setBusinessName(data.businessName ?? "");
        setCountryCode(data.countryCode ?? "");
        setAddress1(data.businessAddress1 ?? "");
        setAddress2(data.businessAddress2 ?? "");
        setCity(data.businessCity ?? "");
        setState(data.businessState ?? "");
        setPostalCode(data.businessPostalCode ?? "");
        setCountry(data.businessCountry ?? "");
      })
      .catch(() =>
        setMessage({ type: "error", text: "Failed to load tenant details" }),
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/tenant-admin/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          countryCode: countryCode.toUpperCase(),
          businessAddress1: address1 || null,
          businessAddress2: address2 || null,
          businessCity: city || null,
          businessState: state || null,
          businessPostalCode: postalCode || null,
          businessCountry: country || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }

      const updated: TenantData = await res.json();
      setTenant(updated);
      setMessage({ type: "success", text: "Company details saved" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <User className="h-4 w-4" aria-hidden="true" />
          Profile
        </div>
        <h1 className="bs-page-title">Your Profile</h1>
        <p className="bs-page-subtitle">
          Manage your account settings, security, and company information.
        </p>
      </div>

      {/* Company Details Section */}
      <div className="flex justify-center">
        <section className="bs-card bs-card-pad w-full max-w-4xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-bs-md bg-bs-card-2 p-2.5">
              <Building2
                className="h-5 w-5 text-bs-fg"
                aria-hidden="true"
              />
            </div>
            <div>
              <h2
                className="text-[22px] leading-tight"
                style={sectionTitleStyle}
              >
                Company Details
              </h2>
              <p className="text-sm text-bs-fg-muted">
                Business address and country settings used for shipping and
                compliance.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                className="h-6 w-6 animate-spin text-bs-fg-muted"
                aria-hidden="true"
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-bs-fg">
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="countryCode" className="text-bs-fg">
                    Country Code (ISO 2-letter)
                  </Label>
                  <Input
                    id="countryCode"
                    value={countryCode}
                    onChange={(e) =>
                      setCountryCode(e.target.value.toUpperCase().slice(0, 2))
                    }
                    placeholder="ZA"
                    maxLength={2}
                    className="uppercase"
                  />
                  <p className="text-xs text-bs-fg-muted">
                    Used for Dr Green API region. Examples: ZA, PT, GB, DE
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-bs-fg">
                    Country
                  </Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="South Africa"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address1" className="text-bs-fg">
                    Address Line 1
                  </Label>
                  <Input
                    id="address1"
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address2" className="text-bs-fg">
                    Address Line 2
                  </Label>
                  <Input
                    id="address2"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    placeholder="Suite 100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-bs-fg">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cape Town"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-bs-fg">
                    State / Province
                  </Label>
                  <Input
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Western Cape"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode" className="text-bs-fg">
                    Postal Code
                  </Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="8001"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {message && (
                    <p
                      className={
                        message.type === "success"
                          ? "text-sm text-bs-green"
                          : "text-sm text-bs-danger"
                      }
                    >
                      {message.text}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="bs-btn bs-btn-green"
                  onClick={handleSave}
                  disabled={saving || !businessName.trim()}
                >
                  {saving && (
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Clerk User Profile */}
      <div className="flex justify-center">
        <UserProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full max-w-4xl",
              card: "shadow-none border border-bs-border-100 bg-bs-card text-bs-fg",
              navbar: "hidden",
              navbarButton:
                "text-bs-fg-muted hover:text-bs-fg hover:bg-bs-card-2",
              headerTitle: "text-bs-fg",
              headerSubtitle: "text-bs-fg-muted",
              formButtonPrimary:
                "bg-bs-green text-bs-canvas hover:bg-bs-green/90",
              formFieldInput: "bg-bs-canvas border-bs-border-100 text-bs-fg",
              formFieldLabel: "text-bs-fg",
              dividerLine: "bg-bs-border-100",
              dividerText: "text-bs-fg-muted",
            },
          }}
        />
      </div>
    </div>
  );
}
