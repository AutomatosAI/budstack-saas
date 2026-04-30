"use client";

import { UserProfile } from "@clerk/nextjs";
import { User } from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default function SuperAdminProfilePage() {
  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Your Profile
        </h1>
        <p className="bs-page-subtitle">
          Manage your account settings, security, and personal information.
        </p>
      </div>

      <div className="flex justify-center">
        <UserProfile
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full max-w-4xl",
              card: "shadow-none border border-bs-border-100 bg-bs-card text-bs-fg",
              navbar: "hidden",
              headerTitle: "text-bs-fg font-display font-bold",
              headerSubtitle: "text-bs-fg-muted",
              formButtonPrimary:
                "bs-btn bs-btn-green",
              formFieldInput:
                "bg-bs-card-2 border-bs-border-100 text-bs-fg",
              formFieldLabel: "text-bs-fg",
              profileSectionTitleText: "text-bs-fg",
              profileSectionContent: "text-bs-fg-muted",
              accordionTriggerButton: "text-bs-fg hover:text-bs-fg",
              menuButton: "text-bs-fg-muted hover:text-bs-fg",
            },
          }}
        />
      </div>
    </div>
  );
}
