"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Globe, Key, Zap, Mail } from "lucide-react";

interface SettingsFormProps {
  tenant: {
    id: string;
    businessName: string;
    subdomain: string;
    customDomain: string | null;
    nftTokenId: string | null;
    drGreenApiUrl?: string | null;
    drGreenApiKey?: string | null;
    drGreenSecretKey?: string | null;
    settings?: any;
  };
}

export default function SettingsForm({ tenant }: SettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const hasApiKey = Boolean(tenant.drGreenApiKey);
  const [formData, setFormData] = useState({
    customDomain: tenant.customDomain || "",
    drGreenApiUrl: tenant.drGreenApiUrl || "",
    drGreenApiKey: "",
    drGreenSecretKey: "",
    smtpHost: tenant.settings?.smtp?.host || "",
    smtpPort: tenant.settings?.smtp?.port || "587",
    smtpUser: tenant.settings?.smtp?.user || "",
    smtpPassword: "",
    smtpFromEmail: tenant.settings?.smtp?.fromEmail || "",
    smtpFromName: tenant.settings?.smtp?.fromName || "",
  });

  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const smtpConfigured = !!tenant.settings?.smtp?.password;

  const handleTestSmtp = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }
    setTestLoading(true);
    try {
      const res = await fetch("/api/tenant-admin/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      toast.success("Connection Successful! Test email sent.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/tenant-admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      toast.success("Settings updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Domain Settings */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="icon-badge">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Domain Configuration
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your store&apos;s domain settings
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <Label className="text-foreground font-medium">Default Subdomain</Label>
            <div className="flex items-center mt-2">
              <Input
                value={tenant.subdomain}
                disabled
                className="flex-1 rounded-xl bg-slate-50"
              />
              <span className="ml-3 font-medium text-muted-foreground">.budstack.to</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              This is your permanent subdomain
            </p>
          </div>
          <div>
            <Label htmlFor="customDomain" className="text-foreground font-medium">
              Custom Domain (Optional)
            </Label>
            <Input
              id="customDomain"
              value={formData.customDomain}
              onChange={(e) =>
                setFormData({ ...formData, customDomain: e.target.value })
              }
              placeholder="yourdispensary.com"
              className="mt-2 rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Contact support after adding a custom domain for DNS configuration
            </p>
          </div>
        </div>
      </div>

      {/* NFT Information */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="icon-badge">
            <Key className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              NFT License
            </h2>
            <p className="text-sm text-muted-foreground">
              Your store license information
            </p>
          </div>
        </div>
        <div>
          <Label className="text-foreground font-medium">NFT Token ID</Label>
          <Input
            value={tenant.nftTokenId || "Not set"}
            disabled
            className="mt-2 rounded-xl bg-slate-50"
          />
          <p className="text-xs text-muted-foreground mt-2">
            This NFT verifies your license to operate on BudStack.io
          </p>
        </div>
      </div>

      {/* Dr. Green Integration */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-emerald-500 p-3">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Dr. Green Integration
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure your connection to the Dr. Green API
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <Label htmlFor="drGreenApiKey" className="text-foreground font-medium">
              API Key
            </Label>
            <Input
              id="drGreenApiKey"
              value={formData.drGreenApiKey}
              onChange={(e) =>
                setFormData({ ...formData, drGreenApiKey: e.target.value })
              }
              placeholder={hasApiKey ? "******** (Verified)" : "Paste your Public Key here"}
              className="mt-2 rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {hasApiKey ? "Leave empty to keep existing key." : "Required for Dr. Green integration."}
            </p>
          </div>
          <div>
            <Label htmlFor="drGreenSecretKey" className="text-foreground font-medium">
              Secret Key
            </Label>
            <Input
              id="drGreenSecretKey"
              type="password"
              value={formData.drGreenSecretKey}
              onChange={(e) =>
                setFormData({ ...formData, drGreenSecretKey: e.target.value })
              }
              placeholder={
                tenant.drGreenSecretKey
                  ? "******** (Verified)"
                  : "Paste your Private Key here"
              }
              className="mt-2 rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {tenant.drGreenSecretKey
                ? "Leave empty to keep existing secret."
                : "Required for submitting consultations."}
            </p>
          </div>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-purple-600 p-3">
            <Mail className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Email Configuration (SMTP)
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure your custom email server for branding
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="smtpHost" className="text-foreground font-medium">
                SMTP Host
              </Label>
              <Input
                id="smtpHost"
                value={formData.smtpHost}
                onChange={(e) =>
                  setFormData({ ...formData, smtpHost: e.target.value })
                }
                placeholder="smtp.mailgun.org"
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="smtpPort" className="text-foreground font-medium">
                Port
              </Label>
              <Input
                id="smtpPort"
                value={formData.smtpPort}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPort: e.target.value })
                }
                placeholder="587"
                className="mt-2 rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="smtpUser" className="text-foreground font-medium">
                Username
              </Label>
              <Input
                id="smtpUser"
                value={formData.smtpUser}
                onChange={(e) =>
                  setFormData({ ...formData, smtpUser: e.target.value })
                }
                placeholder="postmaster@domain.com"
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="smtpPassword" className="text-foreground font-medium">
                Password
              </Label>
              <Input
                type="password"
                id="smtpPassword"
                value={formData.smtpPassword}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPassword: e.target.value })
                }
                placeholder={smtpConfigured ? "******** (Verified)" : "Enter password"}
                className="mt-2 rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="smtpFromName" className="text-foreground font-medium">
                Sender Name
              </Label>
              <Input
                id="smtpFromName"
                value={formData.smtpFromName}
                onChange={(e) =>
                  setFormData({ ...formData, smtpFromName: e.target.value })
                }
                placeholder={tenant.businessName}
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="smtpFromEmail" className="text-foreground font-medium">
                Sender Email
              </Label>
              <Input
                id="smtpFromEmail"
                value={formData.smtpFromEmail}
                onChange={(e) =>
                  setFormData({ ...formData, smtpFromEmail: e.target.value })
                }
                placeholder="orders@yourdomain.com"
                className="mt-2 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-slate-200">
            <Input
              placeholder="Test Email Address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-[280px] rounded-xl"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={handleTestSmtp}
              disabled={testLoading || !smtpConfigured}
            >
              {testLoading ? "Verifying..." : "Test Connection"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Save settings before testing.
            </p>
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
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
