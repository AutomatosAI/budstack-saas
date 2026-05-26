"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { RowPill } from "@/components/admin/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface TenantEditFormProps {
  tenant: {
    id: string;
    businessName: string;
    subdomain: string;
    customDomain?: string | null;
    countryCode: string;
    nftTokenId?: string | null;
    settings?: any;
    createdAt: Date;
    updatedAt: Date;
  };
}

export default function TenantEditForm({ tenant }: TenantEditFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState(tenant.businessName);
  const [subdomain, setSubdomain] = useState(tenant.subdomain);
  const [customDomain, setCustomDomain] = useState(tenant.customDomain || "");
  const [countryCode, setCountryCode] = useState(tenant.countryCode);
  const [contactEmail, setContactEmail] = useState(
    (tenant.settings as any)?.contactEmail || "",
  );
  const [contactPhone, setContactPhone] = useState(
    (tenant.settings as any)?.contactPhone || "",
  );
  const [address, setAddress] = useState(
    (tenant.settings as any)?.address || "",
  );

  // DNS verification state
  const [verifying, setVerifying] = useState(false);
  const [domainVerification, setDomainVerification] = useState<{
    status: "verified" | "pending" | "misconfigured";
    checkedAt: string;
    expected: string;
    found: string | null;
    domain?: string;
    isApex?: boolean;
    cnameTarget?: string;
  } | null>((tenant.settings as any)?.domainVerification || null);

  const handleVerifyDomain = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await fetch(
        `/api/super-admin/tenants/${tenant.id}/verify-domain`,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Verification failed");
      }
      const result = await res.json();
      setDomainVerification(result);
      toast.success(`Domain status: ${result.status}`);
    } catch (error: any) {
      toast.error(error.message || "DNS verification failed");
    } finally {
      setVerifying(false);
    }
  }, [tenant.id]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          subdomain,
          customDomain: customDomain || null,
          countryCode,
          settings: {
            ...(tenant.settings || {}),
            contactEmail,
            contactPhone,
            address,
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update tenant");
      }

      toast.success("Tenant updated successfully");
      setIsEditing(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update tenant");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setBusinessName(tenant.businessName);
    setSubdomain(tenant.subdomain);
    setCustomDomain(tenant.customDomain || "");
    setCountryCode(tenant.countryCode);
    setContactEmail((tenant.settings as any)?.contactEmail || "");
    setContactPhone((tenant.settings as any)?.contactPhone || "");
    setAddress((tenant.settings as any)?.address || "");
    setIsEditing(false);
  };

  return (
    <section className="bs-card bs-card-pad">
      <div className="flex justify-between items-center mb-6">
        <h2
          className="text-[22px] leading-tight text-bs-fg"
          style={sectionTitleStyle}
        >
          Tenant Information
        </h2>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="bs-btn bs-btn-ghost bs-btn-sm"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="bs-btn bs-btn-ghost bs-btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bs-btn bs-btn-green bs-btn-sm"
            >
              {isSaving ? (
                <>
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Business Name */}
        <div className="space-y-2">
          <Label htmlFor="businessName" className="text-bs-fg">
            Business Name
          </Label>
          {isEditing ? (
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          ) : (
            <p className="text-base text-bs-fg">{tenant.businessName}</p>
          )}
        </div>

        {/* Subdomain */}
        <div className="space-y-2">
          <Label htmlFor="subdomain" className="text-bs-fg">
            Subdomain
          </Label>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              />
              <span className="text-sm text-bs-fg-muted whitespace-nowrap font-mono">
                .{process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io"}
              </span>
            </div>
          ) : (
            <p className="text-base text-bs-fg font-mono">
              {tenant.subdomain}.
              {process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io"}
            </p>
          )}
        </div>

        {/* NFT Token ID (read-only) */}
        <div className="space-y-2">
          <Label className="text-bs-fg">NFT Token ID</Label>
          <p className="text-base text-bs-fg-muted font-mono">
            {tenant.nftTokenId || "Not set"}
          </p>
        </div>

        {/* Custom Domain */}
        <div className="space-y-2">
          <Label htmlFor="customDomain" className="text-bs-fg">
            Custom Domain
          </Label>
          {isEditing ? (
            <Input
              id="customDomain"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="example.com"
            />
          ) : (
            <p className="text-base text-bs-fg font-mono">
              {tenant.customDomain || "None"}
            </p>
          )}
        </div>

        {/* DNS Verification & Instructions (shown when custom domain is set) */}
        {tenant.customDomain && (
          <div className="col-span-2 space-y-4 rounded-bs-md border border-bs-border-100 bg-bs-card-2/50 p-4">
            <div className="flex items-center justify-between">
              <h4
                className="text-[18px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Domain Verification
              </h4>
              <button
                type="button"
                onClick={handleVerifyDomain}
                disabled={verifying}
                className="bs-btn bs-btn-ghost bs-btn-sm gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {verifying ? "Checking..." : "Verify DNS"}
              </button>
            </div>

            {/* Status badge */}
            {domainVerification && (
              <div className="flex items-center gap-2 flex-wrap">
                {domainVerification.status === "verified" && (
                  <RowPill tone="emerald">
                    <CheckCircle2
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Verified
                  </RowPill>
                )}
                {domainVerification.status === "pending" && (
                  <RowPill tone="amber">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Pending
                  </RowPill>
                )}
                {domainVerification.status === "misconfigured" && (
                  <RowPill tone="red">
                    <AlertCircle
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    Misconfigured
                  </RowPill>
                )}
                {domainVerification.checkedAt && (
                  <span className="text-xs text-bs-fg-muted font-mono">
                    Last checked:{" "}
                    {format(
                      new Date(domainVerification.checkedAt),
                      "MMM d, HH:mm",
                    )}
                  </span>
                )}
              </div>
            )}

            {/* Misconfigured details */}
            {domainVerification?.status === "misconfigured" && (
              <div className="rounded-bs-sm bg-bs-danger/10 border border-bs-danger/30 p-3 text-sm text-bs-fg">
                <p>
                  <span className="font-medium">Expected:</span>{" "}
                  <span className="font-mono text-bs-fg-muted">
                    {domainVerification.expected}
                  </span>
                </p>
                <p>
                  <span className="font-medium">Found:</span>{" "}
                  <span className="font-mono text-bs-fg-muted">
                    {domainVerification.found || "—"}
                  </span>
                </p>
              </div>
            )}

            {/* DNS Instructions — show actual records from Railway */}
            <div className="space-y-2">
              <h5 className="bs-eyebrow">DNS Records Required</h5>
              {(() => {
                const dnsRecords = (tenant.settings as any)
                  ?.railwayDnsRecords as
                  | Array<{
                      hostlabel: string;
                      requiredValue: string;
                      status: string;
                    }>
                  | undefined;

                if (!dnsRecords || dnsRecords.length === 0) {
                  return (
                    <p className="text-sm text-bs-fg-muted">
                      DNS records not provisioned yet. Click{" "}
                      <strong className="text-bs-fg">Edit</strong> then{" "}
                      <strong className="text-bs-fg">Save Changes</strong> to
                      provision the domain on Railway and fetch DNS records.
                    </p>
                  );
                }

                return (
                  <div className="space-y-3">
                    <p className="text-sm text-bs-fg-muted">
                      Add these records at the registrar for{" "}
                      <strong className="text-bs-fg font-mono">
                        {tenant.customDomain}
                      </strong>
                      :
                    </p>
                    {dnsRecords.map((record, i) => {
                      const isTxt = record.hostlabel.startsWith("_");
                      const recordType = isTxt ? "TXT" : "CNAME";
                      return (
                        <div
                          key={i}
                          className="rounded-bs-sm bg-bs-canvas border border-bs-border-100 p-3 font-mono text-xs space-y-1 text-bs-fg"
                        >
                          <p>
                            <span className="text-bs-fg-muted">Type:</span>{" "}
                            {recordType}
                            {!isTxt &&
                            tenant.customDomain!.split(".").length <= 2
                              ? " (or ALIAS/ANAME for apex)"
                              : ""}
                          </p>
                          <p>
                            <span className="text-bs-fg-muted">Host:</span>{" "}
                            {record.hostlabel || "@"}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="break-all">
                              <span className="text-bs-fg-muted">Value:</span>{" "}
                              {record.requiredValue}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                copyToClipboard(record.requiredValue)
                              }
                              className="text-bs-fg-muted hover:text-bs-fg shrink-0"
                              aria-label="Copy value"
                            >
                              <Copy
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              <button
                type="button"
                className="bs-btn bs-btn-ghost bs-btn-sm text-xs"
                onClick={() => {
                  const dnsRecords = (tenant.settings as any)
                    ?.railwayDnsRecords as
                    | Array<{ hostlabel: string; requiredValue: string }>
                    | undefined;
                  if (!dnsRecords) return;
                  const lines = dnsRecords.map((r, i) => {
                    const isTxt = r.hostlabel.startsWith("_");
                    return `${i + 1}. ${isTxt ? "TXT" : "CNAME"}\n   Host: ${r.hostlabel || "@"}\n   Value: ${r.requiredValue}`;
                  });
                  copyToClipboard(
                    `DNS Records for ${tenant.customDomain}\n\n${lines.join("\n\n")}`,
                  );
                }}
              >
                <Copy className="h-3 w-3 mr-1" aria-hidden="true" />
                Copy full instructions
              </button>
            </div>
          </div>
        )}

        {/* Country Code */}
        <div className="space-y-2">
          <Label htmlFor="countryCode" className="text-bs-fg">
            Country Code
          </Label>
          {isEditing ? (
            <Input
              id="countryCode"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              placeholder="PT"
              maxLength={2}
            />
          ) : (
            <p className="text-base text-bs-fg font-mono">
              {tenant.countryCode}
            </p>
          )}
        </div>

        {/* Contact Email */}
        <div className="space-y-2">
          <Label htmlFor="contactEmail" className="text-bs-fg">
            Contact Email
          </Label>
          {isEditing ? (
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          ) : (
            <p className="text-base text-bs-fg">
              {(tenant.settings as any)?.contactEmail || (
                <span className="text-bs-fg-muted">Not set</span>
              )}
            </p>
          )}
        </div>

        {/* Contact Phone */}
        <div className="space-y-2">
          <Label htmlFor="contactPhone" className="text-bs-fg">
            Contact Phone
          </Label>
          {isEditing ? (
            <Input
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+351 21 234 5678"
            />
          ) : (
            <p className="text-base text-bs-fg">
              {(tenant.settings as any)?.contactPhone || (
                <span className="text-bs-fg-muted">Not set</span>
              )}
            </p>
          )}
        </div>

        {/* Address - full width */}
        <div className="col-span-2 space-y-2">
          <Label htmlFor="address" className="text-bs-fg">
            Address
          </Label>
          {isEditing ? (
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full business address"
              rows={3}
            />
          ) : (
            <p className="text-base text-bs-fg">
              {(tenant.settings as any)?.address || (
                <span className="text-bs-fg-muted">Not set</span>
              )}
            </p>
          )}
        </div>

        {/* Created Date (read-only) */}
        <div className="space-y-2">
          <Label className="text-bs-fg">Created</Label>
          <p className="text-base text-bs-fg-muted font-mono">
            {format(new Date(tenant.createdAt), "MMM d, yyyy")}
          </p>
        </div>

        {/* Last Updated (read-only) */}
        <div className="space-y-2">
          <Label className="text-bs-fg">Last Updated</Label>
          <p className="text-base text-bs-fg-muted font-mono">
            {format(new Date(tenant.updatedAt), "MMM d, yyyy")}
          </p>
        </div>
      </div>
    </section>
  );
}
