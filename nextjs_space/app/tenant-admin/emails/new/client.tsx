"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailEditor,
  EmailTemplateData,
} from "@/components/admin/email/EmailEditor";
import { toast } from "sonner";

export function TenantNewTemplateClient() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: EmailTemplateData) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/tenant-admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create template");

      toast.success("Template created successfully");
      router.refresh();
      router.push("/tenant-admin/emails");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="bs-page-header-centered pb-6 border-b border-bs-border-100">
        <div className="bs-eyebrow">Email</div>
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Create New Template
        </h1>
        <p className="bs-page-subtitle">Design a custom email template.</p>
      </div>
      <div className="flex-1 pt-6 overflow-hidden">
        <EmailEditor onSave={handleSave} isSaving={isSaving} />
      </div>
    </div>
  );
}
