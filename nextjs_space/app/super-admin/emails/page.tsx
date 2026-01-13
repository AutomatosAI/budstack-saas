import React from "react";
import { EmailTemplateList } from "@/components/admin/email/EmailTemplateList";
import { EmailEventMapper } from "@/components/admin/email/EmailEventMapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmailTemplatesPage() {
  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <Tabs defaultValue="templates" className="flex flex-col h-full">
        <div className="px-6 py-4 border-b flex flex-row items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Email Management
            </h1>
            <p className="text-muted-foreground">
              Create templates and map them to system events.
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="events">Event Triggers</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 p-6 overflow-auto bg-slate-50/50">
          <TabsContent value="templates" className="mt-0 space-y-4">
            <EmailTemplateList />
          </TabsContent>
          <TabsContent value="events" className="mt-0 space-y-4">
            <EmailEventMapper />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
