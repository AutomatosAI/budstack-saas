"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface EmailTemplate {
    id: string;
    name: string;
}

interface EmailMapping {
    id: string;
    eventType: string;
    templateId: string;
    isActive: boolean;
}

const SYSTEM_EVENTS = [
    {
        id: "welcome",
        label: "User Welcome Email",
        description: "Sent when a new user signs up.",
    },
    {
        id: "passwordReset",
        label: "Password Reset",
        description: "Sent when user requests password reset.",
    },
    {
        id: "tenantWelcome",
        label: "Tenant Welcome",
        description: "Sent when a new tenant is created.",
    },
    {
        id: "orderConfirmation",
        label: "Order Confirmation",
        description: "Sent after purchase.",
    },
];

export const EmailEventMapper = () => {
    const { data: templates, isLoading: loadingTemplates } = useSWR<
        EmailTemplate[]
    >("/api/super-admin/email-templates", fetcher);

    const { data: mappings, isLoading: loadingMappings } = useSWR<EmailMapping[]>(
        "/api/super-admin/email-mappings",
        fetcher,
    );

    const [saving, setSaving] = useState<string | null>(null);

    const getActiveTemplateId = (eventId: string) => {
        if (!mappings || !Array.isArray(mappings)) return undefined;
        const mapping = mappings.find((m) => m.eventType === eventId);
        return mapping?.templateId;
    };

    const handleSaveMapping = async (eventId: string, templateId: string) => {
        setSaving(eventId);
        try {
            const res = await fetch("/api/super-admin/email-mappings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventType: eventId,
                    templateId: templateId,
                    isActive: true,
                }),
            });

            if (!res.ok) throw new Error("Failed to save mapping");

            toast.success("Event mapping updated");
            mutate("/api/super-admin/email-mappings");
        } catch (error) {
            toast.error("Failed to update mapping");
        } finally {
            setSaving(null);
        }
    };

    if (loadingTemplates || loadingMappings) {
        return (
            <div className="bs-card bs-card-pad flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-bs-fg-muted" />
            </div>
        );
    }

    const templateList = Array.isArray(templates) ? templates : [];

    return (
        <div className="bs-card bs-card-pad">
            <div className="space-y-1 border-b border-bs-border-100 pb-4">
                <h2
                    className="font-display text-[22px] text-bs-fg"
                    style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
                >
                    System Event Mappings
                </h2>
                <p className="text-sm text-bs-fg-muted">
                    Map system events to specific email templates. These defaults will be
                    used unless overridden by a tenant.
                </p>
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="bs-table w-full">
                    <thead>
                        <tr>
                            <th className="text-left">Event</th>
                            <th className="text-left">Template</th>
                            <th className="hidden text-left md:table-cell">Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SYSTEM_EVENTS.map((event) => {
                            const currentTemplateId = getActiveTemplateId(event.id);
                            const isSaving = saving === event.id;
                            return (
                                <tr key={event.id}>
                                    <td>
                                        <div className="font-medium text-bs-fg">{event.label}</div>
                                        <div className="hidden text-xs text-bs-fg-muted md:block">
                                            {event.description}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={currentTemplateId || "default"}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== "default")
                                                        handleSaveMapping(event.id, val);
                                                }}
                                                disabled={isSaving}
                                                className="bs-select w-[180px] md:w-[250px]"
                                            >
                                                <option value="default" disabled>
                                                    Select a template...
                                                </option>
                                                {templateList.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {isSaving && (
                                                <Loader2 className="h-4 w-4 animate-spin text-bs-fg-muted" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell">
                                        <span
                                            className={
                                                currentTemplateId
                                                    ? "bs-chip bs-chip-green"
                                                    : "bs-chip bs-chip-muted"
                                            }
                                        >
                                            {currentTemplateId ? "Active" : "Not Set"}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleSaveMapping(
                                                    event.id,
                                                    currentTemplateId || "default",
                                                )
                                            }
                                            disabled={isSaving || !currentTemplateId}
                                            className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">Save</span>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
