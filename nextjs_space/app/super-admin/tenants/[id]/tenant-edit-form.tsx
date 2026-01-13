"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

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
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Tenant Information</CardTitle>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              Edit
            </Button>
          ) : (
            <div className="space-x-2">
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
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
                  .budstack.to
                </span>
              </div>
            ) : (
              <p className="text-base">{tenant.subdomain}.budstack.to</p>
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
