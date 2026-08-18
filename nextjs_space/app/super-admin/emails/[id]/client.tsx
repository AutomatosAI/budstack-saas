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
  /** US-013 — the mapped event, or null. Selects the merge tags on offer. */
  eventType?: string | null;
}

export function EditTemplateClient({
  template,
  eventType,
}: EditTemplateClientProps) {
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

  // The same sized-wrapper shape as the tenant-admin email screens: the editor
  // is h-full and fills a `flex-1 overflow-hidden` box instead of guessing the
  // viewport, so the Save header can never be scrolled out of reach.
  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="shrink-0 space-y-4">
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
      </div>

      <div className="flex-1 overflow-hidden pt-6">
        <EmailEditor
          initialData={template}
          onSave={handleSave}
          isSaving={isSaving}
          testSendUrl={`/api/super-admin/email-templates/${template.id}/test-send`}
          previewUrl="/api/super-admin/email-templates/preview"
          templateId={template.id}
          eventType={eventType}
        />
      </div>
    </div>
  );
}
