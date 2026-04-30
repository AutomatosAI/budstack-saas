"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import {
  EmailEditor,
  EmailTemplateData,
} from "@/components/admin/email/EmailEditor";
import { toast } from "@/components/ui/sonner";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default function NewEmailTemplatePage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: EmailTemplateData) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/super-admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create template");

      toast.success("Template created successfully");
      router.push("/super-admin/emails");
    } catch {
      toast.error("Failed to create template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <Link
        href="/super-admin/emails"
        className="inline-flex items-center text-sm text-bs-fg-muted hover:text-bs-fg"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Back to Email Templates
      </Link>

      <div className="bs-page-header-centered">
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Create Template
        </h1>
        <p className="bs-page-subtitle">
          Design a new system email template.
        </p>
      </div>

      <EmailEditor onSave={handleSave} isSaving={isSaving} />
    </div>
  );
}
