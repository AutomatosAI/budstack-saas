"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailEditor,
  EmailTemplateData,
} from "@/components/admin/email/EmailEditor";
import { toast } from "sonner";

interface EditTemplateClientProps {
  template: {
    id: string;
    name: string;
    subject: string;
    contentHtml: string;
    description: string;
    category: string;
  };
}

export function TenantEditTemplateClient({
  template,
}: EditTemplateClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: EmailTemplateData) => {
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/tenant-admin/email-templates/${template.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) throw new Error("Failed to update template");

      toast.success("Template updated successfully");
      router.refresh();
      router.push("/tenant-admin/emails");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="bs-page-header-centered pb-6 border-b border-bs-border-100">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Edit Custom Template
        </h1>
        <p className="bs-page-subtitle">
          Editing: <span className="font-mono text-bs-fg">{template.name}</span>
        </p>
      </div>
      <div className="flex-1 pt-6 overflow-hidden">
        <EmailEditor
          initialData={template}
          onSave={handleSave}
          isSaving={isSaving}
          testSendUrl={`/api/tenant-admin/email-templates/${template.id}/test-send`}
        />
      </div>
    </div>
  );
}
