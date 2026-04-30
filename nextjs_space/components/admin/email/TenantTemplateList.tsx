"use client";

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Edit, Trash2, Loader2, Plus, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse template list response:", parseError);
    }
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch (${res.status}): ${text || res.statusText}`);
  }
  return data;
};

interface Template {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  isSystem: boolean;
  isActive: boolean;
}

export function TenantTemplateList() {
  const router = useRouter();
  const {
    data: templates,
    error,
    isLoading,
    mutate,
  } = useSWR<Template[]>("/api/tenant-admin/email-templates", fetcher);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure? If this template is active, the event will revert to System Default.",
      )
    ) {
      return;
    }
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/tenant-admin/email-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Template deleted");
      mutate();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleClone = async (sourceId: string) => {
    let loadingToastId: string | number | undefined;
    try {
      loadingToastId = toast.loading("Cloning template...");
      const res = await fetch("/api/tenant-admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTemplateId: sourceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      toast.success("Template cloned");
      router.refresh();
      router.push(`/tenant-admin/emails/${data.id}`);
    } catch (err) {
      console.error(err);
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
      }
      toast.error("Failed to clone template");
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/tenant-admin/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");

      toast.success(currentStatus ? "Template disabled" : "Template enabled");
      mutate();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  if (isLoading) {
    return (
      <div className="bs-card bs-card-pad flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-bs-fg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bs-card bs-card-pad text-sm text-bs-danger">
        Failed to load templates.
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="bs-card bs-card-pad flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-bs-fg-muted">
          No templates yet. Create your first email template.
        </p>
        <Link href="/tenant-admin/emails/new">
          <span className="bs-btn bs-btn-green bs-btn-sm">
            <Plus className="h-4 w-4" /> <span>New Template</span>
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bs-card bs-card-pad">
      <div className="overflow-x-auto">
        <table className="bs-table w-full">
          <thead>
            <tr>
              <th className="text-left">Template Name</th>
              <th className="text-left">Status</th>
              <th className="hidden text-left md:table-cell">Last Updated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td className="font-medium text-bs-fg">
                  {template.name}
                  {template.description && (
                    <div className="max-w-[150px] truncate text-xs text-bs-fg-muted sm:max-w-[300px]">
                      {template.description}
                    </div>
                  )}
                </td>
                <td>
                  <span
                    className={
                      template.isSystem
                        ? "bs-chip bs-chip-muted"
                        : "bs-chip bs-chip-info"
                    }
                  >
                    {template.isSystem ? "System" : "Custom"}
                  </span>
                </td>
                <td className="hidden font-mono text-bs-fg-muted tabular-nums md:table-cell">
                  {format(new Date(template.updatedAt), "MMM d, yyyy")}
                </td>
                <td className="text-right">
                  <div className="flex min-w-[120px] flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                    {template.isSystem ? (
                      <button
                        type="button"
                        onClick={() => handleClone(template.id)}
                        title="Clone/Customize this template"
                        className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        <Link href={`/tenant-admin/emails/${template.id}`}>
                          <span
                            className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                            title="Edit Template"
                          >
                            <Edit className="h-4 w-4" />
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePublish(template.id, template.isActive)
                          }
                          title={
                            template.isActive ? "Disable Template" : "Enable Template"
                          }
                          className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                        >
                          {template.isActive ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(template.id)}
                          disabled={isDeleting === template.id}
                          className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0 text-bs-danger hover:text-bs-danger"
                          title="Delete Template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
