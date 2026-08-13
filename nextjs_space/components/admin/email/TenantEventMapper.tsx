"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { Loader2, Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { NEWSLETTER_CONFIRM_TEMPLATE } from "@/lib/email/newsletter-confirm";
import { REORDER_REMINDER_EVENT } from "@/lib/email/reorder-reminder";

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
  {
    id: NEWSLETTER_CONFIRM_TEMPLATE,
    label: "Newsletter Confirmation",
    description:
      "Double opt-in: sent when a visitor signs up, carries the confirm link.",
  },
  {
    id: REORDER_REMINDER_EVENT,
    label: "Reorder Reminder",
    description:
      "Marketing: sent by the reorder automation once the switch on this page is on. Only to customers who opted in.",
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

  const getMapping = (eventId: string) =>
    mappings?.find((m) => m.eventType === eventId);

  const handleMappingChange = async (eventId: string, value: string) => {
    setSaving(eventId);
    try {
      if (value === "default") {
        await fetch(`/api/tenant-admin/email-mappings?eventType=${eventId}`, {
          method: "DELETE",
        });
        toast.success("Reverted to System Default");
      } else {
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
      mutate("/api/tenant-admin/email-templates");

      router.push(`/tenant-admin/emails/${data.newTemplateId}`);
    } catch (err) {
      toast.error("Failed to clone template");
      setSaving(null);
    }
  };

  const templatesList = customTemplates || [];

  if (loadingMappings || loadingTemplates) {
    return (
      <div className="bs-card bs-card-pad flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-bs-fg-muted" />
      </div>
    );
  }

  return (
    <div className="bs-card bs-card-pad">
      <div className="overflow-x-auto">
        <table className="bs-table w-full">
          <thead>
            <tr>
              <th className="text-left">Event</th>
              <th className="text-left">Active Template</th>
              <th className="hidden text-left md:table-cell">Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {SYSTEM_EVENTS.map((event) => {
              const mapping = getMapping(event.id);
              const isCustom = mapping?.isCustom || false;
              const currentTemplateId = isCustom
                ? mapping?.template?.id
                : "default";

              const systemTemplateId =
                !isCustom && mapping?.template
                  ? mapping.template.id
                  : undefined;

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
                        onChange={(e) =>
                          handleMappingChange(event.id, e.target.value)
                        }
                        disabled={saving === event.id}
                        className="bs-select w-[180px] md:w-[250px]"
                      >
                        <option value="default">System Default</option>
                        {templatesList.length > 0 && (
                          <option disabled value="separator">
                            ──────────
                          </option>
                        )}
                        {templatesList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {saving === event.id && (
                        <Loader2 className="h-4 w-4 animate-spin text-bs-fg-muted" />
                      )}
                    </div>
                  </td>
                  <td className="hidden md:table-cell">
                    <span
                      className={
                        isCustom
                          ? "bs-chip bs-chip-info"
                          : "bs-chip bs-chip-muted"
                      }
                    >
                      {isCustom ? "Custom" : "Default"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {isCustom ? (
                      <Link
                        href={`/tenant-admin/emails/${mapping?.template?.id}`}
                      >
                        <span className="bs-btn bs-btn-ghost bs-btn-sm">
                          <Edit className="h-4 w-4" /> <span>Edit Template</span>
                        </span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleCustomize(event.id, systemTemplateId)
                        }
                        disabled={!systemTemplateId || saving === event.id}
                        className="bs-btn bs-btn-ghost bs-btn-sm"
                      >
                        <Copy className="h-4 w-4" /> <span>Customize</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
