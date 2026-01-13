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
    createdAt: Date;
    updatedAt: Date;
  };
}

export default function CustomerEditForm({ customer }: CustomerEditFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state - using only fields currently in database
  const [name, setName] = useState(customer.name || "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tenant-admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update customer");
      }

      toast.success("Customer updated successfully");
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
    setName(customer.name || "");
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
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            {isEditing ? (
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer Name"
              />
            ) : (
              <p className="text-base">{customer.name || "Not set"}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-base text-gray-500">{customer.email}</p>
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

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Additional fields (phone, address) will be
            available after running the database migration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
