"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { Cookie, Shield, BarChart3, Target, Globe } from "lucide-react";
import {
  getConsentModel,
  isGDPRRegion,
  isPOPIARegion,
} from "@/lib/cookie-utils";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface CookieSettingsFormProps {
  tenantId: string;
  countryCode: string;
  initialSettings: {
    cookieConsentEnabled: boolean;
    cookieBannerMessage: string;
    cookiePolicyUrl: string;
    analyticsEnabled: boolean;
    marketingCookiesEnabled: boolean;
  };
}

export default function CookieSettingsForm({
  tenantId,
  countryCode,
  initialSettings,
}: CookieSettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(initialSettings);

  const consentModel = getConsentModel(countryCode);
  const isGDPR = isGDPRRegion(countryCode);
  const isPOPIA = isPOPIARegion(countryCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/tenant-admin/cookie-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update cookie settings");

      toast.success("Cookie settings updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update cookie settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Region Info Section */}
      <section className="bs-card bs-card-pad space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-bs-md bg-bs-green/10 p-2.5">
            <Globe className="h-5 w-5 text-bs-green" aria-hidden="true" />
          </div>
          <h2 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            Your Compliance Region
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="bs-eyebrow mb-1">Country Code</p>
            <p className="text-[20px] leading-tight text-bs-fg" style={sectionTitleStyle}>
              {countryCode}
            </p>
          </div>
          <div>
            <p className="bs-eyebrow mb-1">Consent Model</p>
            <p
              className="text-[20px] leading-tight text-bs-fg capitalize"
              style={sectionTitleStyle}
            >
              {consentModel}
            </p>
          </div>
          <div>
            <p className="bs-eyebrow mb-1">GDPR Applies</p>
            <p
              className={`text-[20px] leading-tight ${isGDPR ? "text-bs-warn" : "text-bs-fg-muted"}`}
              style={sectionTitleStyle}
            >
              {isGDPR ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <p className="bs-eyebrow mb-1">POPIA Applies</p>
            <p
              className={`text-[20px] leading-tight ${isPOPIA ? "text-bs-warn" : "text-bs-fg-muted"}`}
              style={sectionTitleStyle}
            >
              {isPOPIA ? "Yes" : "No"}
            </p>
          </div>
        </div>
        {consentModel === "opt-in" && (
          <div className="rounded-bs-md bg-bs-warn/10 border border-bs-warn/30 p-4">
            <p className="text-sm text-bs-fg">
              <strong>Opt-In Required:</strong> Users must give explicit consent
              before non-essential cookies are set.
            </p>
          </div>
        )}
      </section>

      {/* Cookie Banner Settings */}
      <section className="bs-card bs-card-pad space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-bs-md bg-bs-card-2 p-2.5">
            <Cookie className="h-5 w-5 text-bs-fg" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[22px] leading-tight" style={sectionTitleStyle}>
              Cookie Banner
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Configure how the cookie consent banner appears on your storefront
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-bs-md bg-bs-card-2/50 border border-bs-border-100">
            <div>
              <Label
                htmlFor="cookieConsentEnabled"
                className="text-bs-fg font-medium"
              >
                Enable Cookie Banner
              </Label>
              <p className="text-sm text-bs-fg-muted">
                Show cookie consent banner to visitors
              </p>
            </div>
            <Switch
              id="cookieConsentEnabled"
              checked={formData.cookieConsentEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, cookieConsentEnabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="cookieBannerMessage"
              className="text-bs-fg font-medium"
            >
              Custom Banner Message (Optional)
            </Label>
            <Input
              id="cookieBannerMessage"
              value={formData.cookieBannerMessage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cookieBannerMessage: e.target.value,
                })
              }
              placeholder="We use cookies to enhance your experience..."
            />
            <p className="text-xs text-bs-fg-muted">
              Leave empty to use the default message for your region
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cookiePolicyUrl" className="text-bs-fg font-medium">
              Cookie Policy URL (Optional)
            </Label>
            <Input
              id="cookiePolicyUrl"
              value={formData.cookiePolicyUrl}
              onChange={(e) =>
                setFormData({ ...formData, cookiePolicyUrl: e.target.value })
              }
              placeholder="/cookies or https://yoursite.com/cookie-policy"
            />
            <p className="text-xs text-bs-fg-muted">
              Link to your detailed cookie policy page
            </p>
          </div>
        </div>
      </section>

      {/* Cookie Categories */}
      <section className="bs-card bs-card-pad space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-bs-md bg-bs-card-2 p-2.5">
            <Shield className="h-5 w-5 text-bs-fg" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[22px] leading-tight" style={sectionTitleStyle}>
              Cookie Categories
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Enable optional cookie categories for enhanced functionality
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {/* Essential - Always on */}
          <div className="flex items-center justify-between p-5 bg-bs-card-2/50 rounded-bs-md border border-bs-border-100">
            <div className="flex items-start gap-4">
              <div className="rounded-bs-md bg-bs-green/10 p-2.5">
                <Shield className="h-4 w-4 text-bs-green" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-bs-fg">Essential Cookies</p>
                <p className="text-sm text-bs-fg-muted">
                  Required for site functionality (auth, cart, sessions)
                </p>
              </div>
            </div>
            <span className="bs-chip bs-chip-green">Always Enabled</span>
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between p-5 bg-bs-card-2/50 rounded-bs-md border border-bs-border-100">
            <div className="flex items-start gap-4">
              <div className="rounded-bs-md bg-bs-info/10 p-2.5">
                <BarChart3 className="h-4 w-4 text-bs-info" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-bs-fg">Analytics Cookies</p>
                <p className="text-sm text-bs-fg-muted">
                  Track user behavior to improve your store
                </p>
              </div>
            </div>
            <Switch
              checked={formData.analyticsEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, analyticsEnabled: checked })
              }
            />
          </div>

          {/* Marketing */}
          <div className="flex items-center justify-between p-5 bg-bs-card-2/50 rounded-bs-md border border-bs-border-100">
            <div className="flex items-start gap-4">
              <div className="rounded-bs-md bg-bs-card-2 p-2.5">
                <Target className="h-4 w-4 text-bs-fg" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-bs-fg">Marketing Cookies</p>
                <p className="text-sm text-bs-fg-muted">
                  Enable personalized ads and retargeting
                </p>
              </div>
            </div>
            <Switch
              checked={formData.marketingCookiesEnabled}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, marketingCookiesEnabled: checked })
              }
            />
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end">
        <button type="submit" className="bs-btn bs-btn-green" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Cookie Settings"}
        </button>
      </div>
    </form>
  );
}
