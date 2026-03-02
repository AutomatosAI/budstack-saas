
"use client";

import { useEffect, useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { User, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
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
      .catch(() => setMessage({ type: "error", text: "Failed to load tenant details" }))
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
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <User className="h-4 w-4" />
          Profile
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Your Profile
        </h1>
        <p className="mt-3 text-muted-foreground">
          Manage your account settings, security, and company information.
        </p>
      </div>

      {/* Company Details Card */}
      <div className="flex justify-center">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>
                  Business address and country settings used for shipping and compliance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Business Name */}
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                  />
                </div>

                {/* Country Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="countryCode">Country Code (ISO 2-letter)</Label>
                    <Input
                      id="countryCode"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="ZA"
                      maxLength={2}
                      className="uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for Dr Green API region. Examples: ZA, PT, GB, DE
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="South Africa"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address1">Address Line 1</Label>
                    <Input
                      id="address1"
                      value={address1}
                      onChange={(e) => setAddress1(e.target.value)}
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address2">Address Line 2</Label>
                    <Input
                      id="address2"
                      value={address2}
                      onChange={(e) => setAddress2(e.target.value)}
                      placeholder="Suite 100"
                    />
                  </div>
                </div>

                {/* City / State / Postal */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Cape Town"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State / Province</Label>
                    <Input
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Western Cape"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="8001"
                    />
                  </div>
                </div>

                {/* Message + Save */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {message && (
                      <p
                        className={
                          message.type === "success"
                            ? "text-sm text-green-600"
                            : "text-sm text-destructive"
                        }
                      >
                        {message.text}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleSave} disabled={saving || !businessName.trim()}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Clerk User Profile */}
      <div className="flex justify-center">
        <UserProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full max-w-4xl",
              card: "shadow-none border border-border bg-card",
              navbar: "hidden",
              navbarButton: "text-muted-foreground hover:text-foreground hover:bg-muted",
              headerTitle: "text-foreground font-display font-bold",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
              formFieldInput: "bg-background border-input",
            },
          }}
        />
      </div>
    </div>
  );
}
