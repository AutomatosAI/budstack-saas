
"use client";

import { UserProfile } from "@clerk/nextjs";
import { User } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared";

export default function SuperAdminProfilePage() {
    return (
        <div className="space-y-8">
            <AdminPageHeader
                eyebrow="Profile"
                eyebrowIcon={User}
                title="Your Profile"
                subtitle="Manage your account settings, security, and personal information."
            />

            <div className="flex justify-center">
                <UserProfile
                    routing="hash"
                    appearance={{
                        elements: {
                            rootBox: "w-full max-w-4xl",
                            card: "shadow-none border border-border bg-card",
                            navbar: "hidden",
                            headerTitle: "text-foreground font-display font-bold",
                            headerSubtitle: "text-muted-foreground",
                            formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
                        }
                    }}
                />
            </div>
        </div>
    );
}
