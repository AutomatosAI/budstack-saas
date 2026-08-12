import React from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { EditTemplateClient } from "./client";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditEmailTemplatePage({ params }: PageProps) {
    const { id } = await params;
    const template = await prisma.email_templates.findUnique({
        where: { id },
    });

  if (!template) {
    notFound();
  }

  // US-013 — the event this template is mapped to, which decides the merge tags
  // the editor offers. Unscoped like the template lookup above: this screen is
  // super-admin only and a system template's mapping carries no tenant.
  const mapping = await prisma.email_event_mappings.findFirst({
    where: { templateId: template.id },
    select: { eventType: true },
  });

  // Transform to plain object for client component if needed (dates)
  // But Nextjs handles dates fine usually in recent versions,
  // though safe to pass simplified object.
  const serializedTemplate = {
    ...template,
    contentHtml: template.contentHtml,
    description: template.description || "",
    contentJson: template.contentJson || null,
  };

  return (
    <EditTemplateClient
      template={serializedTemplate as any}
      eventType={mapping?.eventType ?? null}
    />
  );
}
