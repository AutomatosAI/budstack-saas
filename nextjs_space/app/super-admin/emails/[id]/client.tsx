"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import {
  EmailEditor,
  EmailTemplateData,
} from "@/components/admin/email/EmailEditor";
import type { EmailContentJson } from "@/lib/email/email-content-json";
import { toast } from "sonner";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface EditTemplateClientProps {
  template: {
    id: string;
    name: string;
    subject: string;
    contentHtml: string;
    description: string;
    category: string;
    /**
     * US-012 — the composer document, straight off the Json column. Present
     * means the template opens in the visual editor; the editor re-checks the
     * shape before trusting it.
     */
    contentJson?: EmailContentJson | null;
  };
}

export function EditTemplateClient({ template }: EditTemplateClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: EmailTemplateData) => {
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/super-admin/email-templates/${template.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) throw new Error("Failed to update template");

      toast.success("Template updated successfully");
      router.refresh();
      router.push("/super-admin/emails");
    } catch {
      toast.error("Failed to update template");
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
          {template.name}
        </h1>
        <p className="bs-page-subtitle">
          Update the system email template content and metadata.
        </p>
      </div>

      <EmailEditor
        initialData={template}
        onSave={handleSave}
        isSaving={isSaving}
        testSendUrl={`/api/super-admin/email-templates/${template.id}/test-send`}
      />
    </div>
  );
}
