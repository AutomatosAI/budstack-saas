"use client";

// Force rebuild: 1

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500">Failed to load templates.</div>;
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="rounded-md border bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No templates yet. Create your first email template.
        </p>
        <Link href="/tenant-admin/emails/new" className="mt-4 inline-block">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" /> New Template
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  {template.name}
                  {template.description && (
                    <div className="max-w-[150px] sm:max-w-[300px] truncate text-xs text-muted-foreground">
                      {template.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={template.isSystem ? "secondary" : "default"}
                    className={
                      !template.isSystem ? "bg-slate-900 dark:bg-slate-700" : ""
                    }
                  >
                    {template.isSystem ? "System" : "Custom"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {format(new Date(template.updatedAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 flex-nowrap whitespace-nowrap min-w-[120px]">
                    {template.isSystem ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClone(template.id)}
                        title="Clone/Customize this template"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    ) : (
                      <>
                        <Link href={`/tenant-admin/emails/${template.id}`} passHref>
                          <Button variant="ghost" size="icon" title="Edit Template">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleTogglePublish(template.id, template.isActive)
                          }
                          title={
                            template.isActive ? "Disable Template" : "Enable Template"
                          }
                          className={
                            template.isActive
                              ? "text-amber-600 hover:text-amber-700"
                              : "text-green-600 hover:text-green-700"
                          }
                        >
                          {template.isActive ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                          disabled={isDeleting === template.id}
                          className="text-destructive hover:text-destructive/90"
                          title="Delete Template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
