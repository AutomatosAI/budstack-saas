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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Template {
  id: string;
  name: string;
  description: string | null;
}

interface Mapping {
  eventType: string;
  isCustom: boolean;
  template: Template | null;
}

// Ensure this matches server constant
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
    description: "Sent to tenant admin on signup.",
  },
  {
    id: "orderConfirmation",
    label: "Order Confirmation",
    description: "Sent after purchase.",
  },
  {
    id: "userInvite",
    label: "User Invitation",
    description: "Sent when inviting a user.",
  },
  {
    id: "paymentFailed",
    label: "Payment Failed",
    description: "Sent on payment failure.",
  },
  {
    id: "subscriptionUpdated",
    label: "Subscription Updated",
    description: "Sent on plan change.",
  },
];

export function TenantEventMapper() {
  const router = useRouter();
  const { data: mappings, isLoading: loadingMappings } = useSWR<Mapping[]>(
    "/api/tenant-admin/email-mappings",
    fetcher,
  );
  const { data: customTemplates, isLoading: loadingTemplates } = useSWR<
    Template[]
  >("/api/tenant-admin/email-templates", fetcher);

  const [saving, setSaving] = useState<string | null>(null);

  // Helper to find specific mapping for an event
  const getMapping = (eventId: string) =>
    mappings?.find((m) => m.eventType === eventId);

  const handleMappingChange = async (eventId: string, value: string) => {
    setSaving(eventId);
    try {
      if (value === "default") {
        // Reset to Default (DELETE)
        await fetch(`/api/tenant-admin/email-mappings?eventType=${eventId}`, {
          method: "DELETE",
        });
        toast.success("Reverted to System Default");
      } else {
        // Set Custom Template (POST)
        await fetch("/api/tenant-admin/email-mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: eventId, templateId: value }),
        });
        toast.success("Event mapping updated");
      }
      mutate("/api/tenant-admin/email-mappings");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update mapping");
    } finally {
      setSaving(null);
    }
  };

  const handleCustomize = async (
    eventId: string,
    originalTemplateId: string | undefined,
  ) => {
    // Logic to Clone System Default if available
    // Note: The UI doesn't explicitly expose System Template IDs here easily unless we fetch them.
    // But `mappings` returns `template` object even for defaults (if logic in API is correct fallback).
    // Let's rely on the mapping data.
    if (!originalTemplateId) {
      toast.error("Cannot customize: No default template found.");
      return;
    }

    try {
      setSaving(eventId);
      const res = await fetch("/api/tenant-admin/email-templates/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: eventId, originalTemplateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Template cloned!");
      mutate("/api/tenant-admin/email-mappings");
      mutate("/api/tenant-admin/email-templates"); // Refresh custom list

      // Redirect to edit? Or stay here? User might want to edit immediately.
      router.push(`/tenant-admin/emails/${data.newTemplateId}`);
    } catch (err) {
      toast.error("Failed to clone template");
      setSaving(null);
    }
  };

  if (loadingMappings || loadingTemplates)
    return (
      <div>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  const templatesList = customTemplates || [];

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Active Template</TableHead>
              <TableHead>Active Template</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SYSTEM_EVENTS.map((event) => {
              const mapping = getMapping(event.id);
              const isCustom = mapping?.isCustom || false;
              const currentTemplateId = isCustom
                ? mapping?.template?.id
                : "default";

              // We need original Template ID for "Customize" button logic (Cloning).
              // If it's default, mapping.template.id is the System Template ID.
              const systemTemplateId =
                !isCustom && mapping?.template
                  ? mapping.template.id
                  : undefined;

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
                        onValueChange={(val) =>
                          handleMappingChange(event.id, val)
                        }
                        disabled={saving === event.id}
                      >
                        <SelectTrigger className="w-[180px] md:w-[250px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            <span className="font-semibold">
                              System Default
                            </span>
                          </SelectItem>
                          {templatesList.length > 0 && (
                            <SelectItem disabled value="separator">
                              ──────────
                            </SelectItem>
                          )}
                          {templatesList.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {saving === event.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      variant={isCustom ? "default" : "outline"}
                      className={isCustom ? "bg-slate-900" : ""}
                    >
                      {isCustom ? "Custom" : "Default"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {isCustom ? (
                      <Link
                        href={`/tenant-admin/emails/${mapping?.template?.id}`}
                      >
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4 mr-2" /> Edit Template
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleCustomize(event.id, systemTemplateId)
                        }
                        disabled={!systemTemplateId || saving === event.id}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Customize
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
