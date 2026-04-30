"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTemplateList } from "@/components/admin/email/TenantTemplateList";
import { TenantEventMapper } from "@/components/admin/email/TenantEventMapper";
import { Button } from "@/components/ui/button";
import { Plus, Mail } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/shared";

export default function TenantEmailsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <AdminPageHeader
        eyebrow="Email"
        eyebrowIcon={Mail}
        title="Email Templates"
        subtitle="Create templates and map them to system events."
        actions={
          <Link href="/tenant-admin/emails/new">
            <Button variant="hero" size="lg" className="rounded-xl shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-4 w-4" /> Create Template
            </Button>
          </Link>
        }
      />

      <Tabs defaultValue="templates" className="space-y-4">
        <div className="flex justify-start">
          {" "}
          {/* Left aligned tabs usually better? Or right? User screenshot had Filter/Tabs. I'll stick to left or standard. */}
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
