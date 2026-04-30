import React from "react";
import { EmailTemplateList } from "@/components/admin/email/EmailTemplateList";
import { EmailEventMapper } from "@/components/admin/email/EmailEventMapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared";

export default function EmailTemplatesPage() {
  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Email"
        eyebrowIcon={Mail}
        title="Email Templates"
        subtitle="Create templates and map them to system events."
      />

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
