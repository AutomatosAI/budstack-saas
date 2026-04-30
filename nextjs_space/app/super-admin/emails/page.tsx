import React from "react";
import { EmailTemplateList } from "@/components/admin/email/EmailTemplateList";
import { EmailEventMapper } from "@/components/admin/email/EmailEventMapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail } from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default function EmailTemplatesPage() {
  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Email
        </div>
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Email Templates
        </h1>
        <p className="bs-page-subtitle">
          Create templates and map them to system events.
        </p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="mb-6 bg-bs-card border border-bs-border-100 rounded-bs-md p-1">
          <TabsTrigger
            value="templates"
            className="rounded-bs-sm data-[state=active]:bg-bs-green data-[state=active]:text-bs-canvas"
          >
            Templates
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="rounded-bs-sm data-[state=active]:bg-bs-green data-[state=active]:text-bs-canvas"
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
