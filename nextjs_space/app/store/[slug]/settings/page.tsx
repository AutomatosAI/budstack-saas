"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { User, Mail, Shield, Save, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { toast } from "@/components/ui/sonner";

export default function SettingsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(`/store/${slug}/login`);
    }
    if (user) {
      // Load existing data
      // Note: user.firstName etc are available directly.
      // Address might be in metadata or external DB. 
      // For now we map what we can from Clerk User or assume metadata structure.
      // We'll trust the component to handle empty strings if not present.

      const meta = user.publicMetadata as any;
      const unsafe = user.unsafeMetadata as any;

      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: (user.primaryPhoneNumber?.phoneNumber) || (unsafe?.phone) || "",
        addressLine1: unsafe?.address?.addressLine1 || "",
        addressLine2: unsafe?.address?.addressLine2 || "",
        city: unsafe?.address?.city || "",
        state: unsafe?.address?.state || "",
        postalCode: unsafe?.address?.postalCode || "",
        country: unsafe?.address?.country || "",
      });
    }
  }, [isLoaded, isSignedIn, router, slug, user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully!");
      setIsEditing(false);
      // Refresh session
      window.location.reload();
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-20">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-900 mb-2">
              Account Settings
            </h1>
            <p className="text-gray-600">Manage your account information</p>
          </div>
          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              Edit Profile
            </Button>
          )}
        </div>

        {/* Profile Information */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold text-green-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                {isEditing ? (
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="mt-1"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                    {formData.firstName || "Not set"}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                {isEditing ? (
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="mt-1"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                    {formData.lastName || "Not set"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {user.primaryEmailAddress?.emailAddress}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                {isEditing ? (
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="pl-10"
                      placeholder="+1234567890"
                    />
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {formData.phone || "Not set"}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Account Role</Label>
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-2 mt-1">
                  <Shield className="w-4 h-4 text-gray-400" />
                  {(user.publicMetadata?.role as string) || "PATIENT"}
                </div>
              </div>

              <div>
                <Label>Verification Status</Label>
                <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg mt-1">
                  <span className="text-yellow-800 font-medium">
                    Pending Verification
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold text-green-900 mb-6 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Address
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="addressLine1">Address Line 1</Label>
              {isEditing ? (
                <Input
                  id="addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine1: e.target.value })
                  }
                  className="mt-1"
                  placeholder="Street address"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                  {formData.addressLine1 || "Not set"}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
              {isEditing ? (
                <Input
                  id="addressLine2"
                  value={formData.addressLine2}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine2: e.target.value })
                  }
                  className="mt-1"
                  placeholder="Apartment, suite, etc."
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                  {formData.addressLine2 || "Not set"}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                {isEditing ? (
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="mt-1"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                    {formData.city || "Not set"}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="state">State/Province</Label>
                {isEditing ? (
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    className="mt-1"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                    {formData.state || "Not set"}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                {isEditing ? (
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    className="mt-1"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                    {formData.postalCode || "Not set"}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              {isEditing ? (
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  className="mt-1"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg mt-1">
                  {formData.country || "Not set"}
                </div>
              )}
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form
                    const userData = user?.publicMetadata as any;
                    const unsafe = user?.unsafeMetadata as any;
                    setFormData({
                      firstName: user?.firstName || "",
                      lastName: user?.lastName || "",
                      phone: (user?.primaryPhoneNumber?.phoneNumber) || (unsafe?.phone) || "",
                      addressLine1: unsafe?.address?.addressLine1 || "",
                      addressLine2: unsafe?.address?.addressLine2 || "",
                      city: unsafe?.address?.city || "",
                      state: unsafe?.address?.state || "",
                      postalCode: unsafe?.address?.postalCode || "",
                      country: unsafe?.address?.country || "",
                    });
                  }}
                  variant="outline"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-6">
          <Link href={`/store/${slug}/dashboard`}>
            <Button variant="ghost">← Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
