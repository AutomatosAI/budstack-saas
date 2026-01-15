
"use client";

import { UserProfile } from "@clerk/nextjs";
import { User, Settings } from "lucide-react";

export default function TenantProfilePage() {
    return (
        <div className="space-y-8">
            {/* Centered Header */}
            <div className="text-center max-w-2xl mx-auto">
                <div className="section-badge mb-4 inline-flex">
                    <User className="h-4 w-4" />
                    Profile
                </div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Your Profile
                </h1>
                <p className="mt-3 text-muted-foreground">
                    Manage your account settings, security, and personal information.
                </p>
            </div>

            <div className="flex justify-center">
                <UserProfile
                    routing="hash"
                    appearance={{
                        elements: {
                            rootBox: "w-full max-w-4xl",
                            card: "shadow-none border border-border bg-card",
                            navbar: "hidden", // Hide sidebar for cleaner embedding if desired, or keep it
                            navbarButton: "text-muted-foreground hover:text-foreground hover:bg-muted",
                            headerTitle: "text-foreground font-display font-bold",
                            headerSubtitle: "text-muted-foreground",
                            formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
                            formFieldInput: "bg-background border-input",
                        }
                    }}
                />
            </div>
        </div>
    );
}
