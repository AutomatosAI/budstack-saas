"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { Globe, Zap, Mail, ShieldCheck, Info, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FEATURES, hasFeature } from "@/lib/entitlements/features";
import {
  getTenantVerificationMode,
  isSaIdEligibleTenant,
} from "@/lib/verification-mode";

/**
 * US-017 — what these SMTP fields have to be for a newsletter to arrive.
 *
 * Transactional mail is a trickle and almost any relay carries it; a campaign
 * is the whole list in one sitting, and the two most common setups here (a
 * Gmail app password, a hosting provider's shared relay) throttle or cut off
 * part-way through — which reads as "the platform lost my emails" rather than
 * as a provider limit. Said where the credentials are entered, because that is
 * where the choice is actually made.
 */
const SMTP_CAMPAIGN_GUIDANCE =
  "Sending newsletters or campaigns needs a real email provider (Mailgun, SendGrid, Postmark, Amazon SES). A Gmail app password is fine for order confirmations, but Google caps it at roughly 500 recipients a day and will stop a campaign part-way through.";

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
    automatosApiKey?: string | null;
    automatosAgentId?: number | null;
    automatosChatbotEnabled?: boolean;
    countryCode?: string | null;
    settings?: any;
  };
  // Entitlement keys granted to this tenant, resolved server-side by the page.
  features: string[];
}

export default function SettingsForm({ tenant, features }: SettingsFormProps) {
  const chatbotEntitled = hasFeature(features, FEATURES.AUTOMATOS_CHATBOT);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const hasApiKey = Boolean(tenant.drGreenApiKey);
  const saEligible = isSaIdEligibleTenant(tenant);
  const [formData, setFormData] = useState({
    customDomain: tenant.customDomain || "",
    verificationMode: getTenantVerificationMode(tenant),
    drGreenApiUrl: tenant.drGreenApiUrl || "",
    drGreenApiKey: "",
    drGreenSecretKey: "",
    automatosApiKey: tenant.automatosApiKey || "",
    automatosAgentId: tenant.automatosAgentId?.toString() || "",
    automatosChatbotEnabled: tenant.automatosChatbotEnabled ?? false,
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

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update settings");
      }

      toast.success("Settings updated successfully");
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Domain Settings */}
      <section className="bs-card bs-card-pad">
        <header className="mb-6 flex items-center gap-4">
          <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
            <Globe className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              className="font-display text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Domain Configuration
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Manage your store&apos;s domain settings
            </p>
          </div>
        </header>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="bs-eyebrow">Default Subdomain</label>
            <div className="flex items-center gap-3">
              <input
                value={tenant.subdomain}
                disabled
                className="bs-input flex-1 opacity-70"
              />
              <span className="font-mono text-sm text-bs-fg-muted">
                .{process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io"}
              </span>
            </div>
            <p className="text-xs text-bs-fg-muted">
              This is your permanent subdomain
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="customDomain" className="bs-eyebrow">
              Custom Domain (Optional)
            </label>
            <input
              id="customDomain"
              value={formData.customDomain}
              onChange={(e) =>
                setFormData({ ...formData, customDomain: e.target.value })
              }
              placeholder="yourdispensary.com"
              className="bs-input w-full"
            />
            <p className="text-xs text-bs-fg-muted">
              Contact support after adding a custom domain for DNS configuration
            </p>
          </div>
        </div>
      </section>

      {/* NFT License section hidden — feature not in use (tenant.nftTokenId retained in DB) */}

      {/* Dr. Green Integration */}
      <section className="bs-card bs-card-pad">
        <header className="mb-6 flex items-center gap-4">
          <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
            <Zap className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              className="font-display text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Dr. Green Integration
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Configure your connection to the Dr. Green API
            </p>
          </div>
        </header>
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="drGreenApiKey" className="bs-eyebrow">
              API Key
            </label>
            <textarea
              id="drGreenApiKey"
              value={formData.drGreenApiKey}
              onChange={(e) =>
                setFormData({ ...formData, drGreenApiKey: e.target.value })
              }
              placeholder={
                hasApiKey ? "******** (Verified)" : "Paste your Public Key here"
              }
              rows={3}
              className="bs-input w-full resize-y font-mono"
            />
            <p className="text-xs text-bs-fg-muted">
              {hasApiKey
                ? "Leave empty to keep existing key."
                : "Required for Dr. Green integration."}
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="drGreenSecretKey" className="bs-eyebrow">
              Secret Key
            </label>
            <textarea
              id="drGreenSecretKey"
              value={formData.drGreenSecretKey}
              onChange={(e) =>
                setFormData({ ...formData, drGreenSecretKey: e.target.value })
              }
              placeholder={
                tenant.drGreenSecretKey
                  ? "******** (Verified)"
                  : "Paste your Private Key here"
              }
              rows={3}
              className="bs-input w-full resize-y font-mono"
            />
            <p className="text-xs text-bs-fg-muted">
              {tenant.drGreenSecretKey
                ? "Leave empty to keep existing secret."
                : "Required for submitting consultations."}
            </p>
          </div>
        </div>
      </section>

      {/* Customer Verification (South Africa only) */}
      {saEligible && (
        <section className="bs-card bs-card-pad">
          <header className="mb-6 flex items-center gap-4">
            <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
              <ShieldCheck className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2
                className="font-display text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Customer Verification
              </h2>
              <p className="text-sm text-bs-fg-muted">
                Choose how South African customers verify before they can order
              </p>
            </div>
          </header>
          <div className="space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-xl border border-bs-border-100 bg-bs-card-2 p-4">
              <input
                type="radio"
                name="verificationMode"
                value="KYC"
                checked={formData.verificationMode === "KYC"}
                onChange={() =>
                  setFormData({ ...formData, verificationMode: "KYC" })
                }
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-bs-fg">
                  KYC / AML verification
                </span>
                <span className="block text-xs text-bs-fg-muted">
                  Customers complete the full consultation and First-AML KYC.
                  This is the default and is required outside South Africa.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-bs-border-100 bg-bs-card-2 p-4">
              <input
                type="radio"
                name="verificationMode"
                value="ID_UPLOAD"
                checked={formData.verificationMode === "ID_UPLOAD"}
                onChange={() =>
                  setFormData({ ...formData, verificationMode: "ID_UPLOAD" })
                }
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-bs-fg">
                  ID document upload
                </span>
                <span className="block text-xs text-bs-fg-muted">
                  Customers skip the consultation and upload a valid government
                  ID for review. Approval verifies them to order. South Africa
                  only.
                </span>
              </span>
            </label>
            <p className="text-xs text-bs-fg-muted">
              One method applies to all your customers — you can switch at any
              time.
            </p>
          </div>
        </section>
      )}

      {/* Automatos Integration */}
      <section className="bs-card bs-card-pad">
        <header className="mb-6 flex items-center gap-4">
          <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
            <Zap className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              className="font-display text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Automatos AI Integration
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Configure your storefront Chatbot
            </p>
          </div>
        </header>
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-4">
            <div className="space-y-1">
              <p className="font-medium text-bs-fg flex items-center gap-2">
                Enable Storefront Chatbot
                {!chatbotEntitled && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-bs-border-100 px-2 py-0.5 text-xs text-bs-fg-muted">
                    <Lock className="h-3 w-3" aria-hidden="true" /> Pro
                  </span>
                )}
              </p>
              <p className="text-sm text-bs-fg-muted">
                {chatbotEntitled
                  ? formData.automatosApiKey
                    ? "Shows the AI chat bubble on your storefront."
                    : "Save an API key below, then switch this on."
                  : "Included in the Pro plan — upgrade to turn on your storefront AI assistant."}
              </p>
            </div>
            <Switch
              checked={formData.automatosChatbotEnabled}
              disabled={!chatbotEntitled}
              onCheckedChange={(checked: boolean) =>
                setFormData({ ...formData, automatosChatbotEnabled: checked })
              }
              aria-label="Enable storefront chatbot"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="automatosApiKey" className="bs-eyebrow">
              Automatos API Key (Public)
            </label>
            <input
              id="automatosApiKey"
              value={formData.automatosApiKey}
              onChange={(e) =>
                setFormData({ ...formData, automatosApiKey: e.target.value })
              }
              placeholder="ak_pub_..."
              className="bs-input w-full font-mono"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="automatosAgentId" className="bs-eyebrow">
              Agent ID (Optional)
            </label>
            <input
              id="automatosAgentId"
              type="number"
              value={formData.automatosAgentId}
              onChange={(e) =>
                setFormData({ ...formData, automatosAgentId: e.target.value })
              }
              placeholder="e.g. 42"
              className="bs-input w-full font-mono"
            />
          </div>
        </div>
      </section>

      {/* Email Configuration */}
      <section className="bs-card bs-card-pad">
        <header className="mb-6 flex items-center gap-4">
          <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
            <Mail className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2
              className="font-display text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Email Configuration (SMTP)
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Configure your custom email server for branding
            </p>
          </div>
        </header>
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-3 text-sm text-bs-fg-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{SMTP_CAMPAIGN_GUIDANCE}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="smtpHost" className="bs-eyebrow">
                SMTP Host
              </label>
              <input
                id="smtpHost"
                value={formData.smtpHost}
                onChange={(e) =>
                  setFormData({ ...formData, smtpHost: e.target.value })
                }
                placeholder="smtp.mailgun.org"
                className="bs-input w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="smtpPort" className="bs-eyebrow">
                Port
              </label>
              <input
                id="smtpPort"
                value={formData.smtpPort}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPort: e.target.value })
                }
                placeholder="587"
                className="bs-input w-full font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="smtpUser" className="bs-eyebrow">
                Username
              </label>
              <input
                id="smtpUser"
                value={formData.smtpUser}
                onChange={(e) =>
                  setFormData({ ...formData, smtpUser: e.target.value })
                }
                placeholder="postmaster@domain.com"
                className="bs-input w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="smtpPassword" className="bs-eyebrow">
                Password
              </label>
              <input
                type="password"
                id="smtpPassword"
                value={formData.smtpPassword}
                onChange={(e) =>
                  setFormData({ ...formData, smtpPassword: e.target.value })
                }
                placeholder={
                  smtpConfigured ? "******** (Verified)" : "Enter password"
                }
                className="bs-input w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="smtpFromName" className="bs-eyebrow">
                Sender Name
              </label>
              <input
                id="smtpFromName"
                value={formData.smtpFromName}
                onChange={(e) =>
                  setFormData({ ...formData, smtpFromName: e.target.value })
                }
                placeholder={tenant.businessName}
                className="bs-input w-full"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="smtpFromEmail" className="bs-eyebrow">
                Sender Email
              </label>
              <input
                id="smtpFromEmail"
                value={formData.smtpFromEmail}
                onChange={(e) =>
                  setFormData({ ...formData, smtpFromEmail: e.target.value })
                }
                placeholder="orders@yourdomain.com"
                className="bs-input w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-bs-border-100 pt-6">
            <input
              placeholder="Test Email Address"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="bs-input max-w-[280px]"
            />
            <button
              type="button"
              onClick={handleTestSmtp}
              disabled={testLoading || !smtpConfigured}
              className="bs-btn bs-btn-ghost"
            >
              {testLoading ? "Verifying..." : "Test Connection"}
            </button>
            <p className="text-xs text-bs-fg-muted">
              Save settings before testing.
            </p>
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="bs-btn bs-btn-green"
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
