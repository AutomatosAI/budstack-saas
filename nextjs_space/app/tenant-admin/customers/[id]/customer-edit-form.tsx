"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

interface CustomerEditFormProps {
  customer: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    address: any;
    createdAt: Date;
    updatedAt: Date;
  };
}

export default function CustomerEditForm({ customer }: CustomerEditFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState(customer.firstName || "");
  const [lastName, setLastName] = useState(customer.lastName || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [newEmail, setNewEmail] = useState(customer.email);

  const emailChanged = newEmail.toLowerCase().trim() !== customer.email.toLowerCase().trim();

  const handleSave = async () => {
    if (emailChanged && !window.confirm(
      `Change email from "${customer.email}" to "${newEmail}"?\n\nRemember to also update this email in the Clerk Admin dashboard.`
    )) {
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (firstName !== (customer.firstName || "")) payload.firstName = firstName;
      if (lastName !== (customer.lastName || "")) payload.lastName = lastName;
      if (phone !== (customer.phone || "")) payload.phone = phone;
      if (emailChanged) payload.newEmail = newEmail.trim();

      const res = await fetch(`/api/tenant-admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update customer");
      }

      // Show Dr Green sync status if email was changed
      if (emailChanged && data.drGreenSync) {
        if (data.drGreenSync.success) {
          toast.success("Email updated in BudStacks and Dr Green");
        } else {
          toast.warning(`Email updated locally but Dr Green sync failed: ${data.drGreenSync.error}`);
        }
      } else {
        toast.success(data.message || "Customer updated successfully");
      }

      setIsEditing(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update customer");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFirstName(customer.firstName || "");
    setLastName(customer.lastName || "");
    setPhone(customer.phone || "");
    setNewEmail(customer.email);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Customer Information</CardTitle>
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
          {/* First Name */}
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            {isEditing ? (
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name"
              />
            ) : (
              <p className="text-base">{customer.firstName || "Not set"}</p>
            )}
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            {isEditing ? (
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
              />
            ) : (
              <p className="text-base">{customer.lastName || "Not set"}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            {isEditing ? (
              <div className="space-y-1">
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                {emailChanged && (
                  <p className="text-xs text-amber-600">
                    Also update in Clerk Admin dashboard after saving
                  </p>
                )}
              </div>
            ) : (
              <p className="text-base">{customer.email}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            {isEditing ? (
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
              />
            ) : (
              <p className="text-base">{customer.phone || "Not set"}</p>
            )}
          </div>

          {/* Created Date (read-only) */}
          <div className="space-y-2">
            <Label>Customer Since</Label>
            <p className="text-base text-gray-500">
              {format(new Date(customer.createdAt), "MMM d, yyyy")}
            </p>
          </div>

          {/* Last Updated (read-only) */}
          <div className="space-y-2">
            <Label>Last Updated</Label>
            <p className="text-base text-gray-500">
              {format(new Date(customer.updatedAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
