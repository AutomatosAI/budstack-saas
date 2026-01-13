
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailEditor, EmailTemplateData } from '@/components/admin/email/EmailEditor';
import { toast } from '@/components/ui/sonner';

export default function NewEmailTemplatePage() {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: EmailTemplateData) => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/super-admin/email-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error('Failed to create template');

            toast.success('Template created successfully');
            router.push('/super-admin/emails');
        } catch (error) {
            console.error(error);
            toast.error('Failed to create template');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)]">
            <div className="px-6 py-4 border-b">
                <h1 className="text-2xl font-bold tracking-tight">Create Template</h1>
                <p className="text-muted-foreground">Design a new system email template.</p>
            </div>
            <div className="flex-1 p-6 overflow-hidden">
                <EmailEditor onSave={handleSave} isSaving={isSaving} />
            </div>
        </div>
    );
}
