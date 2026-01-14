"use client";

// Force rebuild: 1

import React, { useState } from "react";
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Save, Eye, Code, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface EmailTemplateData {
    name: string;
    subject: string;
    category: string;
    description?: string;
    contentHtml: string;
}

interface EmailEditorProps {
    initialData?: Partial<EmailTemplateData>;
    onSave: (data: EmailTemplateData) => Promise<void>;
    isSaving?: boolean;
}

const COMMON_VARIABLES = [
    {
        category: "Global",
        vars: ["businessName", "subdomain", "loginUrl", "logoUrl", "primaryColor"],
    },
    { category: "User", vars: ["userName", "email", "resetLink"] },
    {
        category: "Order",
        vars: ["orderNumber", "total", "shippingAddress", "items"],
    },
    {
        category: "Helpers",
        vars: ["#each items", "/each", "toFixed price", "multiply price quantity"],
    },
];

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hello {{name}},</h1>
    <p>This is a sample email template.</p>
    <br/>
    <a href="{{link}}" class="button">Click Me</a>
  </div>
</body>
</html>`;

export const EmailEditor = ({
    initialData,
    onSave,
    isSaving = false,
}: EmailEditorProps) => {
    const [formData, setFormData] = useState<EmailTemplateData>({
        name: initialData?.name || "",
        subject: initialData?.subject || "",
        category: initialData?.category || "transactional",
        description: initialData?.description || "",
        contentHtml: initialData?.contentHtml || DEFAULT_HTML,
    });

    const handleChange = (field: keyof EmailTemplateData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!formData.name || !formData.subject) {
            toast.error("Name and Subject are required");
            return;
        }
        await onSave(formData);
    };

    return (
        <div className="flex h-[calc(100vh-100px)] flex-col gap-4">
            <Card className="shrink-0">
                <CardContent className="grid grid-cols-1 items-end gap-4 p-4 md:grid-cols-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Template Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            placeholder="e.g. Welcome Email v1"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="subject">Subject Line</Label>
                        <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => handleChange("subject", e.target.value)}
                            placeholder="Welcome to BudStack, {{name}}!"
                        />
                    </div>
                    <div className="flex justify-end pb-0.5">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" /> Save Template
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex-1 overflow-hidden rounded-md border bg-background">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="flex h-full flex-col border-r">
                            <div className="flex items-center justify-between border-b bg-muted p-2">
                                <span className="flex items-center text-xs font-semibold text-muted-foreground">
                                    <Code className="mr-1 h-3 w-3" /> HTML Source
                                </span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs">
                                            <HelpCircle className="h-3 w-3" /> Variables Reference
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80" align="end">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">
                                                    Available Variables
                                                </h4>
                                                <p className="text-xs text-muted-foreground">
                                                    Click to copy common placeholders. Availability depends
                                                    on the event.
                                                </p>
                                            </div>
                                            <div className="grid gap-3">
                                                {COMMON_VARIABLES.map((group) => (
                                                    <div key={group.category} className="space-y-1">
                                                        <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            {group.category}
                                                        </h5>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.vars.map((variable) => (
                                                                <code
                                                                    key={variable}
                                                                    className="cursor-pointer rounded border bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 transition-colors hover:bg-slate-200 sm:text-xs"
                                                                    onClick={() => {
                                                                        const text = `{{${variable}}}`;
                                                                        navigator.clipboard.writeText(text);
                                                                        toast.success(`Copied ${text}`);
                                                                    }}
                                                                >
                                                                    {`{{${variable}}}`}
                                                                </code>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <Textarea
                                className="flex-1 resize-none rounded-none border-0 p-4 font-mono text-sm leading-relaxed focus-visible:ring-0"
                                value={formData.contentHtml}
                                onChange={(e) => handleChange("contentHtml", e.target.value)}
                                placeholder="<html>...</html>"
                            />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="flex h-full flex-col bg-slate-100">
                            <div className="flex items-center justify-between border-b bg-white p-2">
                                <span className="flex items-center text-xs font-semibold text-muted-foreground">
                                    <Eye className="mr-1 h-3 w-3" /> Live Preview
                                </span>
                            </div>
                            <div className="flex flex-1 items-center justify-center overflow-auto p-4">
                                <div className="mx-auto h-full w-full max-w-[800px] overflow-hidden rounded bg-white shadow-sm">
                                    <iframe
                                        srcDoc={formData.contentHtml}
                                        className="h-full w-full border-0"
                                        title="Email Preview"
                                        sandbox="allow-same-origin"
                                    />
                                </div>
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
};
