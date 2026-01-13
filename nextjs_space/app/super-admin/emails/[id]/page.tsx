import React from "react";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { EditTemplateClient } from "./client";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function EditEmailTemplatePage({ params }: PageProps) {
  const template = await prisma.email_templates.findUnique({
    where: { id: params.id },
  });

  if (!template) {
    notFound();
  }

  // Transform to plain object for client component if needed (dates)
  // But Nextjs handles dates fine usually in recent versions,
  // though safe to pass simplified object.
  const serializedTemplate = {
    ...template,
    contentHtml: template.contentHtml,
    description: template.description || "",
    contentJson: template.contentJson || null,
  };

  return <EditTemplateClient template={serializedTemplate as any} />;
}
