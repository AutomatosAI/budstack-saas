
'use client';

import React, { useState, useEffect } from 'react';
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Save, Eye, Code } from 'lucide-react';
import { toast } from 'sonner';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';

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
    { category: 'Global', vars: ['businessName', 'subdomain', 'loginUrl', 'logoUrl', 'primaryColor'] },
    { category: 'User', vars: ['userName', 'email', 'resetLink'] },
    { category: 'Order', vars: ['orderNumber', 'total', 'shippingAddress', 'items'] },
    { category: 'Helpers', vars: ['#each items', '/each', 'toFixed price', 'multiply price quantity'] },
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

export const EmailEditor = ({ initialData, onSave, isSaving = false }: EmailEditorProps) => {
    const [formData, setFormData] = useState<EmailTemplateData>({
        name: initialData?.name || '',
        subject: initialData?.subject || '',
        category: initialData?.category || 'transactional',
        description: initialData?.description || '',
        contentHtml: initialData?.contentHtml || DEFAULT_HTML,
    });

    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit'); // For mobile/small screens if needed

    // Handle Input Changes
    const handleChange = (field: keyof EmailTemplateData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!formData.name || !formData.subject) {
            toast.error('Name and Subject are required');
            return;
        }
        await onSave(formData);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
            {/* Header / Meta Fields */}
            <Card className="shrink-0">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="name">Template Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="e.g. Welcome Email v1"
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="subject">Subject Line</Label>
                        <Input
                            id="subject"
                            value={formData.subject}
                            onChange={(e) => handleChange('subject', e.target.value)}
                            placeholder="Welcome to BudStack, {{name}}!"
                        />
                    </div>
                    <div className="flex justify-end pb-0.5">
                        <Button onClick={handleSave} disabled={isSaving}>
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

            {/* Main Editor Area */}
            <div className="flex-1 border rounded-md overflow-hidden bg-background">
                <ResizablePanelGroup direction="horizontal">
                    {/* Left Panel: Code Editor */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="flex flex-col h-full border-r">


                            <div className="bg-muted p-2 border-b flex items-center justify-between">
                                <span className="text-xs font-semibold flex items-center text-muted-foreground">
                                    <Code className="h-3 w-3 mr-1" /> HTML Source
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
                                                <h4 className="font-medium leading-none">Available Variables</h4>
                                                <p className="text-xs text-muted-foreground">
                                                    Click to copy common placeholders. Availability depends on the event.
                                                </p>
                                            </div>
                                            <div className="grid gap-3">
                                                {COMMON_VARIABLES.map((group) => (
                                                    <div key={group.category} className="space-y-1">
                                                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.category}</h5>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.vars.map((v) => (
                                                                <code
                                                                    key={v}
                                                                    className="bg-slate-100 border px-1.5 py-0.5 rounded text-[10px] sm:text-xs cursor-pointer hover:bg-slate-200 transition-colors font-mono text-slate-700"
                                                                    onClick={() => {
                                                                        const text = `{{${v}}}`;
                                                                        navigator.clipboard.writeText(text);
                                                                        toast.success(`Copied ${text}`);
                                                                    }}
                                                                >
                                                                    {`{{${v}}}`}
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
                                className="flex-1 resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 p-4 leading-relaxed"
                                value={formData.contentHtml}
                                onChange={(e) => handleChange('contentHtml', e.target.value)}
                                placeholder="<html>...</html>"
                            />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Right Panel: Live Preview */}
                    <ResizablePanel defaultSize={50} minSize={30}>
                        <div className="flex flex-col h-full bg-slate-100">
                            <div className="bg-white border-b p-2 flex items-center justify-between">
                                <span className="text-xs font-semibold flex items-center text-muted-foreground">
                                    <Eye className="h-3 w-3 mr-1" /> Live Preview
                                </span>
                            </div>
                            <div className="flex-1 p-4 flex items-center justify-center overflow-auto">
                                <div className="bg-white shadow-sm w-full h-full max-w-[800px] mx-auto rounded overflow-hidden">
                                    <iframe
                                        srcDoc={formData.contentHtml}
                                        className="w-full h-full border-0"
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
