"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      {/* Region Info Card */}
      <div className="card-floating p-8 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-emerald-500 p-3">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Your Compliance Region
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Country Code
            </p>
            <p className="font-display text-xl font-bold text-foreground">
              {countryCode}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Consent Model
            </p>
            <p className="font-display text-xl font-bold text-foreground capitalize">
              {consentModel}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              GDPR Applies
            </p>
            <p
              className={`font-display text-xl font-bold ${isGDPR ? "text-amber-600" : "text-slate-400"}`}
            >
              {isGDPR ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              POPIA Applies
            </p>
            <p
              className={`font-display text-xl font-bold ${isPOPIA ? "text-amber-600" : "text-slate-400"}`}
            >
              {isPOPIA ? "Yes" : "No"}
            </p>
          </div>
        </div>
        {consentModel === "opt-in" && (
          <div className="mt-6 rounded-xl bg-amber-100 border border-amber-200 p-4">
            <p className="text-sm text-amber-800">
              <strong>Opt-In Required:</strong> Users must give explicit consent
              before non-essential cookies are set.
            </p>
          </div>
        )}
      </div>

      {/* Cookie Banner Settings */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="icon-badge">
            <Cookie className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Cookie Banner
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure how the cookie consent banner appears on your storefront
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <Label htmlFor="cookieConsentEnabled" className="text-foreground font-medium">
                Enable Cookie Banner
              </Label>
              <p className="text-sm text-muted-foreground">
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

          <div>
            <Label htmlFor="cookieBannerMessage" className="text-foreground font-medium">
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
              className="mt-2 rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Leave empty to use the default message for your region
            </p>
          </div>

          <div>
            <Label htmlFor="cookiePolicyUrl" className="text-foreground font-medium">
              Cookie Policy URL (Optional)
            </Label>
            <Input
              id="cookiePolicyUrl"
              value={formData.cookiePolicyUrl}
              onChange={(e) =>
                setFormData({ ...formData, cookiePolicyUrl: e.target.value })
              }
              placeholder="/cookies or https://yoursite.com/cookie-policy"
              className="mt-2 rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Link to your detailed cookie policy page
            </p>
          </div>
        </div>
      </div>

      {/* Cookie Categories */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-purple-600 p-3">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Cookie Categories
            </h2>
            <p className="text-sm text-muted-foreground">
              Enable optional cookie categories for enhanced functionality
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {/* Essential - Always on */}
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-emerald-500 p-2.5">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground">Essential Cookies</p>
                <p className="text-sm text-muted-foreground">
                  Required for site functionality (auth, cart, sessions)
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
              Always Enabled
            </span>
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-blue-500 p-2.5">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground">Analytics Cookies</p>
                <p className="text-sm text-muted-foreground">
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
          <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-purple-500 p-2.5">
                <Target className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-foreground">Marketing Cookies</p>
                <p className="text-sm text-muted-foreground">
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
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="rounded-xl"
          disabled={isLoading}
        >
          {isLoading ? "Saving..." : "Save Cookie Settings"}
        </Button>
      </div>
    </form>
  );
}
