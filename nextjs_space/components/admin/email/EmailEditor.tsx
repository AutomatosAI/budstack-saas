"use client";


import React, { useState } from "react";
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable";
import { Loader2, Save, Eye, Code, HelpCircle, Send } from "lucide-react";
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
    /**
     * US-006 — POST endpoint that queues this template to the signed-in admin.
     * Omitted on the create screens, where there is no saved template yet.
     */
    testSendUrl?: string;
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
    testSendUrl,
}: EmailEditorProps) => {
    const [isSendingTest, setIsSendingTest] = useState(false);
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

    // Sends the SAVED template — the server renders it with sample variables so
    // the inbox copy matches what the worker would produce for a real event.
    const handleSendTest = async () => {
        if (!testSendUrl) return;
        setIsSendingTest(true);
        try {
            const res = await fetch(testSendUrl, { method: "POST" });
            const payload = await res.json().catch(() => null);
            if (!res.ok) {
                // Rate-limit replies carry the useful detail in `message`;
                // the standard apiError envelope only has `error`.
                throw new Error(
                    payload?.message || payload?.error || "Failed to queue test email",
                );
            }
            toast.success(
                payload?.sentTo
                    ? `Test email queued to ${payload.sentTo}`
                    : "Test email queued",
            );
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to send test email",
            );
        } finally {
            setIsSendingTest(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] flex-col gap-4">
            <div className="bs-card bs-card-pad shrink-0">
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                        <label htmlFor="name" className="bs-eyebrow">Template Name</label>
                        <input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            placeholder="e.g. Welcome Email v1"
                            className="bs-input w-full"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label htmlFor="subject" className="bs-eyebrow">Subject Line</label>
                        <input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => handleChange("subject", e.target.value)}
                            placeholder="Welcome to BudStacks, {{name}}!"
                            className="bs-input w-full"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pb-0.5">
                        {testSendUrl && (
                            <button
                                type="button"
                                onClick={handleSendTest}
                                disabled={isSendingTest}
                                title="Sends the saved version of this template to your admin email address"
                                className="bs-btn bs-btn-ghost"
                            >
                                {isSendingTest ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" /> <span>Send test</span>
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bs-btn bs-btn-green"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" /> <span>Save Template</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-bs-md border border-bs-border-100 bg-bs-canvas">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="flex h-full flex-col border-r border-bs-border-100">
                            <div className="flex items-center justify-between border-b border-bs-border-100 bg-bs-card-2 p-2">
                                <span className="flex items-center text-xs font-mono uppercase tracking-wide text-bs-fg-muted">
                                    <Code className="mr-1 h-3 w-3" /> HTML Source
                                </span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button type="button" className="bs-btn bs-btn-ghost bs-btn-sm">
                                            <HelpCircle className="h-3 w-3" /> <span>Variables Reference</span>
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80" align="end">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none text-bs-fg">
                                                    Available Variables
                                                </h4>
                                                <p className="text-xs text-bs-fg-muted">
                                                    Click to copy common placeholders. Availability depends
                                                    on the event.
                                                </p>
                                            </div>
                                            <div className="grid gap-3">
                                                {COMMON_VARIABLES.map((group) => (
                                                    <div key={group.category} className="space-y-1">
                                                        <h5 className="bs-eyebrow">
                                                            {group.category}
                                                        </h5>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.vars.map((variable) => (
                                                                <code
                                                                    key={variable}
                                                                    className="cursor-pointer rounded border border-bs-border-100 bg-bs-card-2 px-1.5 py-0.5 font-mono text-[10px] text-bs-fg transition-colors hover:bg-bs-card-3 sm:text-xs"
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
                            <textarea
                                className="bs-input flex-1 resize-none rounded-none border-0 p-4 font-mono text-sm leading-relaxed focus-visible:ring-0"
                                value={formData.contentHtml}
                                onChange={(e) => handleChange("contentHtml", e.target.value)}
                                placeholder="<html>...</html>"
                            />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="flex h-full flex-col bg-bs-canvas">
                            <div className="flex items-center justify-between border-b border-bs-border-100 bg-bs-card-2 p-2">
                                <span className="flex items-center text-xs font-mono uppercase tracking-wide text-bs-fg-muted">
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
