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
import { toast } from "@/components/ui/sonner";

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
    drGreenSecretKey: "", // Always start empty for security
    // SMTP (from settings json)
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Domain Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Configuration</CardTitle>
          <CardDescription>Manage your store's domain settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Subdomain</Label>
            <div className="flex items-center mt-2">
              <Input value={tenant.subdomain} disabled className="flex-1" />
              <span className="ml-2 text-gray-500">.budstack.to</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is your permanent subdomain
            </p>
          </div>
          <div>
            <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
            <Input
              id="customDomain"
              value={formData.customDomain}
              onChange={(e) =>
                setFormData({ ...formData, customDomain: e.target.value })
              }
              placeholder="yourdispensary.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Contact support after adding a custom domain for DNS configuration
            </p>
          </div>
        </CardContent>
      </Card>

      {/* NFT Information */}
      <Card>
        <CardHeader>
          <CardTitle>NFT License</CardTitle>
          <CardDescription>Your store license information</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>NFT Token ID</Label>
            <Input
              value={tenant.nftTokenId || "Not set"}
              disabled
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              This NFT verifies your license to operate on BudStack.io
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dr. Green Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Dr. Green Integration</CardTitle>
          <CardDescription>
            Configure your connection to the Dr. Green API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="drGreenApiKey">API Key</Label>
            <Input
              id="drGreenApiKey"
              value={formData.drGreenApiKey}
              onChange={(e) =>
                setFormData({ ...formData, drGreenApiKey: e.target.value })
              }
              placeholder={
                hasApiKey ? "******** (Verified)" : "Paste your Public Key here"
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {hasApiKey
                ? "Leave empty to keep existing key."
                : "Required for Dr. Green integration."}
            </p>
          </div>
          <div>
            <Label htmlFor="drGreenSecretKey">Secret Key</Label>
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
            />
            <p className="text-xs text-gray-500 mt-1">
              {tenant.drGreenSecretKey
                ? "Leave empty to keep existing secret."
                : "Required for submitting consultations."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Email Configuration (SMTP)</CardTitle>
          <CardDescription>
            Configure your custom email server for branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                value={formData.smtpHost}
                onChange={(e) =>
                  setFormData({ ...formData, smtpHost: e.target.value })
                }
                placeholder="smtp.mailgun.org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Port</Label>
              <Input
                id="smtpPort"
                value={formData.smtpPort}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPort: e.target.value })
                }
                placeholder="587"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Username</Label>
              <Input
                id="smtpUser"
                value={formData.smtpUser}
                onChange={(e) =>
                  setFormData({ ...formData, smtpUser: e.target.value })
                }
                placeholder="postmaster@domain.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">Password</Label>
              <Input
                type="password"
                id="smtpPassword"
                value={formData.smtpPassword}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPassword: e.target.value })
                }
                placeholder={
                  smtpConfigured ? "******** (Verified)" : "Enter password"
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpFromName">Sender Name</Label>
              <Input
                id="smtpFromName"
                value={formData.smtpFromName}
                onChange={(e) =>
                  setFormData({ ...formData, smtpFromName: e.target.value })
                }
                placeholder={tenant.businessName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpFromEmail">Sender Email</Label>
              <Input
                id="smtpFromEmail"
                value={formData.smtpFromEmail}
                onChange={(e) =>
                  setFormData({ ...formData, smtpFromEmail: e.target.value })
                }
                placeholder="orders@yourdomain.com"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t mt-2">
            <Input
              placeholder="Test Email Address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-[250px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestSmtp}
              disabled={testLoading || !smtpConfigured}
            >
              {testLoading ? "Verifying..." : "Test Connection"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Save settings before testing.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
