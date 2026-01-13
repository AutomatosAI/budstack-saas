"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Region Info Card */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <CardTitle className="text-lg">Your Compliance Region</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Country Code</p>
              <p className="font-semibold text-gray-900">{countryCode}</p>
            </div>
            <div>
              <p className="text-gray-500">Consent Model</p>
              <p className="font-semibold text-gray-900 capitalize">
                {consentModel}
              </p>
            </div>
            <div>
              <p className="text-gray-500">GDPR Applies</p>
              <p
                className={`font-semibold ${isGDPR ? "text-amber-600" : "text-gray-400"}`}
              >
                {isGDPR ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">POPIA Applies</p>
              <p
                className={`font-semibold ${isPOPIA ? "text-amber-600" : "text-gray-400"}`}
              >
                {isPOPIA ? "Yes" : "No"}
              </p>
            </div>
          </div>
          {consentModel === "opt-in" && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-100 p-3 rounded-lg">
              <strong>Opt-In Required:</strong> Users must give explicit consent
              before non-essential cookies are set.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cookie Banner Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-gray-600" />
            <CardTitle>Cookie Banner</CardTitle>
          </div>
          <CardDescription>
            Configure how the cookie consent banner appears on your storefront
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="cookieConsentEnabled" className="text-base">
                Enable Cookie Banner
              </Label>
              <p className="text-sm text-gray-500">
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
            <Label htmlFor="cookieBannerMessage">
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
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to use the default message for your region
            </p>
          </div>

          <div>
            <Label htmlFor="cookiePolicyUrl">
              Cookie Policy URL (Optional)
            </Label>
            <Input
              id="cookiePolicyUrl"
              value={formData.cookiePolicyUrl}
              onChange={(e) =>
                setFormData({ ...formData, cookiePolicyUrl: e.target.value })
              }
              placeholder="/cookies or https://yoursite.com/cookie-policy"
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Link to your detailed cookie policy page
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cookie Categories */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-600" />
            <CardTitle>Cookie Categories</CardTitle>
          </div>
          <CardDescription>
            Enable optional cookie categories for enhanced functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Essential - Always on */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Essential Cookies</p>
              <p className="text-sm text-gray-500">
                Required for site functionality (auth, cart, sessions)
              </p>
            </div>
            <span className="text-emerald-600 font-medium text-sm">
              Always Enabled
            </span>
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Analytics Cookies</p>
                <p className="text-sm text-gray-500">
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
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Marketing Cookies</p>
                <p className="text-sm text-gray-500">
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
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Cookie Settings"}
        </Button>
      </div>
    </form>
  );
}
