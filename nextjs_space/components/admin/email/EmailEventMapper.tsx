"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    // Fetch Templates
    const { data: templates, isLoading: loadingTemplates } = useSWR<
        EmailTemplate[]
    >("/api/super-admin/email-templates", fetcher);

    // Fetch Mappings
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

    if (loadingTemplates || loadingMappings)
        return <div>Loading configuration...</div>;

    const templateList = Array.isArray(templates) ? templates : [];

    return (
        <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100">
                <CardTitle>System Event Mappings</CardTitle>
                <CardDescription>
                    Map system events to specific email templates. These defaults will be
                    used unless overridden by a tenant.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Template</TableHead>
                                <TableHead className="hidden md:table-cell">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {SYSTEM_EVENTS.map((event) => {
                                const currentTemplateId = getActiveTemplateId(event.id);
                                const isSaving = saving === event.id;
                                return (
                                    <TableRow key={event.id}>
                                        <TableCell>
                                            <div className="font-medium">{event.label}</div>
                                            <div className="text-xs text-muted-foreground hidden md:block">
                                                {event.description}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    value={currentTemplateId || "default"}
                                                    onValueChange={(val) => {
                                                        if (val !== "default")
                                                            handleSaveMapping(event.id, val);
                                                    }}
                                                    disabled={isSaving}
                                                >
                                                    <SelectTrigger className="w-[180px] md:w-[250px]">
                                                        <SelectValue placeholder="Select a template" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="default" disabled>
                                                            <em>Select a template...</em>
                                                        </SelectItem>
                                                        {templateList.map((t) => (
                                                            <SelectItem key={t.id} value={t.id}>
                                                                {t.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {isSaving && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {currentTemplateId ? "Active" : "Not Set"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleSaveMapping(
                                                        event.id,
                                                        currentTemplateId || "default",
                                                    )
                                                }
                                                disabled={isSaving || !currentTemplateId}
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                                <span className="sr-only">Save</span>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
