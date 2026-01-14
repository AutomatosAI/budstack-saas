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
      router.refresh(); // Refresh server data
      router.push("/super-admin/emails");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="px-6 py-6 lg:px-8 lg:pt-8 lg:pb-6 border-b">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Edit Template</h1>
        <p className="mt-2 text-slate-500">Editing: {template.name}</p>
      </div>
      <div className="flex-1 p-6 overflow-hidden">
        <EmailEditor
          initialData={template}
          onSave={handleSave}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
