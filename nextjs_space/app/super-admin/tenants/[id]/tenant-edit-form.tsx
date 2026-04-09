"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, Clock, Copy, RefreshCw } from "lucide-react";

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
      console.error(error);
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
    <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
      <CardHeader className="border-b border-slate-100">
        <div className="flex justify-between items-center">
          <CardTitle>Tenant Information</CardTitle>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-full">
              Edit
            </Button>
          ) : (
            <div className="space-x-2">
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={isSaving}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            {isEditing ? (
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            ) : (
              <p className="text-base">{tenant.businessName}</p>
            )}
          </div>

          {/* Subdomain */}
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  .{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io'}
                </span>
              </div>
            ) : (
              <p className="text-base">{tenant.subdomain}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'budstacks.io'}</p>
            )}
          </div>

          {/* NFT Token ID (read-only) */}
          <div className="space-y-2">
            <Label>NFT Token ID</Label>
            <p className="text-base text-gray-500">
              {tenant.nftTokenId || "Not set"}
            </p>
          </div>

          {/* Custom Domain */}
          <div className="space-y-2">
            <Label htmlFor="customDomain">Custom Domain</Label>
            {isEditing ? (
              <Input
                id="customDomain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="example.com"
              />
            ) : (
              <p className="text-base">{tenant.customDomain || "None"}</p>
            )}
          </div>

          {/* DNS Verification & Instructions (shown when custom domain is set) */}
          {tenant.customDomain && (
            <div className="col-span-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Domain Verification</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyDomain}
                  disabled={verifying}
                  className="rounded-full gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
                  {verifying ? "Checking..." : "Verify DNS"}
                </Button>
              </div>

              {/* Status badge */}
              {domainVerification && (
                <div className="flex items-center gap-2">
                  {domainVerification.status === "verified" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                  {domainVerification.status === "pending" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </span>
                  )}
                  {domainVerification.status === "misconfigured" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                      <AlertCircle className="h-3.5 w-3.5" /> Misconfigured
                    </span>
                  )}
                  {domainVerification.checkedAt && (
                    <span className="text-xs text-gray-400">
                      Last checked: {format(new Date(domainVerification.checkedAt), "MMM d, HH:mm")}
                    </span>
                  )}
                </div>
              )}

              {/* Misconfigured details */}
              {domainVerification?.status === "misconfigured" && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                  <p><span className="font-medium">Expected:</span> {domainVerification.expected}</p>
                  <p><span className="font-medium">Found:</span> {domainVerification.found || "—"}</p>
                </div>
              )}

              {/* DNS Instructions — show actual records from Railway */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">DNS Records Required</h5>
                {(() => {
                  const dnsRecords = (tenant.settings as any)?.railwayDnsRecords as Array<{ hostlabel: string; requiredValue: string; status: string }> | undefined;

                  if (!dnsRecords || dnsRecords.length === 0) {
                    return (
                      <p className="text-sm text-gray-500">
                        DNS records not available yet. Try saving the domain again.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        Add these records at the registrar for <strong>{tenant.customDomain}</strong>:
                      </p>
                      {dnsRecords.map((record, i) => {
                        const isTxt = record.hostlabel.startsWith('_');
                        const recordType = isTxt ? 'TXT' : 'CNAME';
                        return (
                          <div key={i} className="rounded-lg bg-white border p-3 font-mono text-xs space-y-1">
                            <p><span className="text-gray-400">Type:</span> {recordType}{!isTxt && tenant.customDomain!.split(".").length <= 2 ? ' (or ALIAS/ANAME for apex)' : ''}</p>
                            <p><span className="text-gray-400">Host:</span> {record.hostlabel || '@'}</p>
                            <div className="flex items-center gap-2">
                              <p className="break-all"><span className="text-gray-400">Value:</span> {record.requiredValue}</p>
                              <button onClick={() => copyToClipboard(record.requiredValue)} className="text-gray-400 hover:text-gray-600 shrink-0">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const dnsRecords = (tenant.settings as any)?.railwayDnsRecords as Array<{ hostlabel: string; requiredValue: string }> | undefined;
                    if (!dnsRecords) return;
                    const lines = dnsRecords.map((r, i) => {
                      const isTxt = r.hostlabel.startsWith('_');
                      return `${i + 1}. ${isTxt ? 'TXT' : 'CNAME'}\n   Host: ${r.hostlabel || '@'}\n   Value: ${r.requiredValue}`;
                    });
                    copyToClipboard(`DNS Records for ${tenant.customDomain}\n\n${lines.join('\n\n')}`);
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copy full instructions
                </Button>
              </div>
            </div>
          )}

          {/* Country Code */}
          <div className="space-y-2">
            <Label htmlFor="countryCode">Country Code</Label>
            {isEditing ? (
              <Input
                id="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                placeholder="PT"
                maxLength={2}
              />
            ) : (
              <p className="text-base">{tenant.countryCode}</p>
            )}
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            {isEditing ? (
              <Input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@example.com"
              />
            ) : (
              <p className="text-base">
                {(tenant.settings as any)?.contactEmail || "Not set"}
              </p>
            )}
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            {isEditing ? (
              <Input
                id="contactPhone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+351 21 234 5678"
              />
            ) : (
              <p className="text-base">
                {(tenant.settings as any)?.contactPhone || "Not set"}
              </p>
            )}
          </div>

          {/* Address - full width */}
          <div className="col-span-2 space-y-2">
            <Label htmlFor="address">Address</Label>
            {isEditing ? (
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full business address"
                rows={3}
              />
            ) : (
              <p className="text-base">
                {(tenant.settings as any)?.address || "Not set"}
              </p>
            )}
          </div>

          {/* Created Date (read-only) */}
          <div className="space-y-2">
            <Label>Created</Label>
            <p className="text-base text-gray-500">
              {format(new Date(tenant.createdAt), "MMM d, yyyy")}
            </p>
          </div>

          {/* Last Updated (read-only) */}
          <div className="space-y-2">
            <Label>Last Updated</Label>
            <p className="text-base text-gray-500">
              {format(new Date(tenant.updatedAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
