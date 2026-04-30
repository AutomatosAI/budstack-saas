"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantTemplateList } from "@/components/admin/email/TenantTemplateList";
import { TenantEventMapper } from "@/components/admin/email/TenantEventMapper";
import { Button } from "@/components/ui/button";
import { Plus, Mail } from "lucide-react";
import Link from "next/link";

export default function TenantEmailsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="relative mb-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="section-badge mb-4 inline-flex">
            <Mail className="h-4 w-4" />
            Email
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Email Templates
          </h1>
          <p className="mt-3 text-muted-foreground mx-auto">
            Create templates and map them to system events.
          </p>
        </div>
        <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <Link href="/tenant-admin/emails/new">
            <Button variant="hero" size="lg" className="rounded-xl shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-4 w-4" /> Create Template
            </Button>
          </Link>
        </div>
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
