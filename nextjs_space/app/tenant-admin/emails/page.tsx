"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTemplateList } from "@/components/admin/email/TenantTemplateList";
import { TenantEventMapper } from "@/components/admin/email/TenantEventMapper";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function TenantEmailsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Email Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Create templates and map them to system events.
          </p>
        </div>
        <Link href="/tenant-admin/emails/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Create Template
          </Button>
        </Link>
      </div>

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
