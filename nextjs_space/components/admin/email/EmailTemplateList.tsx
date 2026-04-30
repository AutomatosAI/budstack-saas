"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from '@/components/ui/sonner';

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch");
    }
    return res.json();
};

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    category: string;
    isActive: boolean;
    updatedAt: string;
    mappings?: any[];
}

export const EmailTemplateList = () => {
    const router = useRouter();
    const {
        data: templates,
        error,
        isLoading,
    } = useSWR<EmailTemplate[]>("/api/super-admin/email-templates", fetcher);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/super-admin/email-templates/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Failed to delete");

            toast.success("Template deleted successfully");
            mutate("/api/super-admin/email-templates");
        } catch (error) {
            toast.error("Failed to delete template");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleTogglePublish = async (id: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`/api/super-admin/email-templates/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus }),
            });
            if (!res.ok) throw new Error("Failed to update");

            toast.success(currentStatus ? "Template disabled" : "Template enabled");
            mutate("/api/super-admin/email-templates");
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
                Failed to load templates: {error.message}
            </div>
        );
    }

    const templateList = Array.isArray(templates) ? templates : [];

    return (
        <div className="bs-card bs-card-pad">
            <div className="flex flex-col gap-3 border-b border-bs-border-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <h2
                        className="font-display text-[22px] text-bs-fg"
                        style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
                    >
                        Email Templates
                    </h2>
                    <p className="text-sm text-bs-fg-muted">
                        Manage your system email templates.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.push("/super-admin/emails/new")}
                    className="bs-btn bs-btn-green"
                >
                    <Plus className="h-4 w-4" /> <span>Create Template</span>
                </button>
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="bs-table w-full">
                    <thead>
                        <tr>
                            <th className="text-left">Name</th>
                            <th className="hidden text-left md:table-cell">Subject</th>
                            <th className="hidden text-left md:table-cell">Category</th>
                            <th className="text-left">Status</th>
                            <th className="hidden text-left md:table-cell">Last Updated</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {templateList.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="py-10 text-center text-sm text-bs-fg-muted"
                                >
                                    No templates found. Create one to get started.
                                </td>
                            </tr>
                        )}
                        {templateList.map((template) => (
                            <tr key={template.id}>
                                <td className="font-medium text-bs-fg">{template.name}</td>
                                <td className="hidden text-bs-fg-muted md:table-cell">
                                    {template.subject}
                                </td>
                                <td className="hidden md:table-cell">
                                    <span className="bs-chip bs-chip-muted capitalize">
                                        {template.category}
                                    </span>
                                </td>
                                <td>
                                    <span
                                        className={
                                            template.isActive
                                                ? "bs-chip bs-chip-green"
                                                : "bs-chip bs-chip-muted"
                                        }
                                    >
                                        {template.isActive ? "Active" : "Inactive"}
                                    </span>
                                </td>
                                <td className="hidden font-mono text-bs-fg-muted tabular-nums md:table-cell">
                                    {new Date(template.updatedAt).toLocaleDateString()}
                                </td>
                                <td className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(`/super-admin/emails/${template.id}`)
                                            }
                                            title="Edit"
                                            className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleTogglePublish(template.id, template.isActive)
                                            }
                                            title={template.isActive ? "Disable" : "Enable"}
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
                                            onClick={() => setIsDeleting(template.id)}
                                            title="Delete"
                                            className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0 text-bs-danger hover:text-bs-danger"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AlertDialog
                open={!!isDeleting}
                onOpenChange={(open) => !open && setIsDeleting(null)}
            >
                <AlertDialogContent className="bs-dialog-content">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            email template.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bs-btn bs-btn-danger"
                            onClick={() => isDeleting && handleDelete(isDeleting)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
