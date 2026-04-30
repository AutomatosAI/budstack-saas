"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTemplateList } from "@/components/admin/email/TenantTemplateList";
import { TenantEventMapper } from "@/components/admin/email/TenantEventMapper";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function TenantEmailsPage() {
  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="bs-page-title"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            Email Templates
          </h1>
          <p className="bs-page-subtitle">
            Create templates and map them to system events.
          </p>
        </div>
        <div className="flex justify-start sm:justify-end">
          <Link
            href="/tenant-admin/emails/new"
            className="bs-btn bs-btn-green"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create Template
          </Link>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <div className="flex justify-start">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="events">Event Triggers</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="templates" className="mt-0">
          <TenantTemplateList />
        </TabsContent>
        <TabsContent value="events" className="mt-0">
          <TenantEventMapper />
        </TabsContent>
      </Tabs>
    </div>
  );
}
