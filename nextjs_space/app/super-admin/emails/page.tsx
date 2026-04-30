import React from "react";
import { EmailTemplateList } from "@/components/admin/email/EmailTemplateList";
import { EmailEventMapper } from "@/components/admin/email/EmailEventMapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail } from "lucide-react";

export default function EmailTemplatesPage() {
  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Mail className="h-4 w-4" />
          Email
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Email Templates
        </h1>
        <p className="mt-3 text-muted-foreground">
          Create templates and map them to system events.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="templates">
        <TabsList className="mb-6 bg-white border border-slate-200 rounded-xl p-1">
          <TabsTrigger
            value="templates"
            className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white"
          >
            Templates
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="rounded-lg data-[state=active]:bg-accent data-[state=active]:text-white"
          >
            Event Triggers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-0 space-y-4">
          <EmailTemplateList />
        </TabsContent>
        <TabsContent value="events" className="mt-0 space-y-4">
          <EmailEventMapper />
        </TabsContent>
      </Tabs>
    </div>
  );
}
