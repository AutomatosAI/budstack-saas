"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTemplateList } from "@/components/admin/email/TenantTemplateList";
import { TenantCampaignList } from "@/components/admin/email/TenantCampaignList";
import { TenantSegmentList } from "@/components/admin/email/TenantSegmentList";
import { TenantEventMapper } from "@/components/admin/email/TenantEventMapper";
import { EmailActivityLog } from "@/components/admin/email/EmailActivityLog";
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
            Email
          </h1>
          <p className="bs-page-subtitle">
            Create templates and campaigns, map templates to system events, and
            review what was sent.
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
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="events">Event Triggers</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="templates" className="mt-0">
          <TenantTemplateList />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-0">
          <TenantCampaignList />
        </TabsContent>
        <TabsContent value="segments" className="mt-0">
          <TenantSegmentList />
        </TabsContent>
        <TabsContent value="events" className="mt-0">
          <TenantEventMapper />
        </TabsContent>
        <TabsContent value="activity" className="mt-0">
          <EmailActivityLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
