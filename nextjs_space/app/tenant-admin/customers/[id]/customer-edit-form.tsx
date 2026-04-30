"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  const [firstName, setFirstName] = useState(customer.firstName || "");
  const [lastName, setLastName] = useState(customer.lastName || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [newEmail, setNewEmail] = useState(customer.email);

  const emailChanged =
    newEmail.toLowerCase().trim() !== customer.email.toLowerCase().trim();

  const handleSave = async () => {
    if (
      emailChanged &&
      !window.confirm(
        `Change email from "${customer.email}" to "${newEmail}"?\n\nThis will update the email across BudStacks, Clerk, and Dr Green.`,
      )
    ) {
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

      if (emailChanged) {
        const failures: string[] = [];
        if (data.clerkSync && !data.clerkSync.success) failures.push("Clerk");
        if (data.drGreenSync && !data.drGreenSync.success)
          failures.push("Dr Green");

        if (failures.length > 0) {
          toast.warning(
            `Email updated locally but sync failed for: ${failures.join(", ")}`,
          );
        } else {
          toast.success("Email updated across all systems");
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
    <section className="bs-card bs-card-pad">
      <div className="bs-card-head mb-6 flex items-center justify-between">
        <h2
          className="text-[22px] text-bs-fg"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Customer Information
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
              className="bs-btn bs-btn-ghost bs-btn-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bs-btn bs-btn-green bs-btn-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="firstName" className="bs-eyebrow">
            First Name
          </label>
          {isEditing ? (
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="bs-input w-full"
            />
          ) : (
            <p className="text-base text-bs-fg">{customer.firstName || "Not set"}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="lastName" className="bs-eyebrow">
            Last Name
          </label>
          {isEditing ? (
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="bs-input w-full"
            />
          ) : (
            <p className="text-base text-bs-fg">{customer.lastName || "Not set"}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="bs-eyebrow">
            Email
          </label>
          {isEditing ? (
            <div className="space-y-1">
              <input
                id="email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bs-input w-full font-mono"
              />
              {emailChanged && (
                <p className="text-xs text-bs-info">
                  Will sync to Clerk and Dr Green automatically
                </p>
              )}
            </div>
          ) : (
            <p className="text-base font-mono text-bs-fg">{customer.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="phone" className="bs-eyebrow">
            Phone
          </label>
          {isEditing ? (
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="bs-input w-full"
            />
          ) : (
            <p className="text-base text-bs-fg">{customer.phone || "Not set"}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="bs-eyebrow">Customer Since</p>
          <p className="text-base font-mono text-bs-fg-muted">
            {format(new Date(customer.createdAt), "MMM d, yyyy")}
          </p>
        </div>

        <div className="space-y-2">
          <p className="bs-eyebrow">Last Updated</p>
          <p className="text-base font-mono text-bs-fg-muted">
            {format(new Date(customer.updatedAt), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {isEditing && (
        <div className="mt-2 pt-2">
          <p className="bs-eyebrow text-bs-fg-muted">
            Customer ID:{" "}
            <span className="font-mono normal-case text-bs-fg-muted">
              {customer.id}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
