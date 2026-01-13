
'use client';

import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, MoreHorizontal, Edit, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to fetch');
    }
    return res.json();
};

interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    category: string;
    isActive: boolean;
    updatedAt: string;
    mappings?: any[];
}

export const EmailTemplateList = () => {
    const router = useRouter();
    const { data: templates, error, isLoading } = useSWR<EmailTemplate[]>('/api/super-admin/email-templates', fetcher);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/super-admin/email-templates/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete');

            toast.success('Template deleted successfully');
            mutate('/api/super-admin/email-templates'); // Refresh list
        } catch (error) {
            toast.error('Failed to delete template');
        } finally {
            setIsDeleting(null);
        }
    };

    const handleTogglePublish = async (id: string, currentStatus: boolean) => {
        try {
            const res = await fetch(`/api/super-admin/email-templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentStatus }),
            });
            if (!res.ok) throw new Error('Failed to update');

            toast.success(currentStatus ? 'Template disabled' : 'Template enabled');
            mutate('/api/super-admin/email-templates');
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    if (isLoading) return <div>Loading templates...</div>;
    if (error) return <div>Failed to load templates: {error.message}</div>;

    // Safety check ensuring templates is an array
    const templateList = Array.isArray(templates) ? templates : [];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>Manage your system email templates.</CardDescription>
                </div>
                <Button onClick={() => router.push('/super-admin/emails/new')}>
                    <Plus className="mr-2 h-4 w-4" /> Create Template
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="hidden md:table-cell">Subject</TableHead>
                                <TableHead className="hidden md:table-cell">Category</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {templateList.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        No templates found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                            {templateList.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">{template.name}</TableCell>
                                    <TableCell className="hidden md:table-cell">{template.subject}</TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <Badge variant="outline" className="capitalize">
                                            {template.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={template.isActive ? 'default' : 'secondary'}>
                                            {template.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {new Date(template.updatedAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => router.push(`/super-admin/emails/${template.id}`)}
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleTogglePublish(template.id, template.isActive)}
                                                title={template.isActive ? 'Disable' : 'Enable'}
                                                className={template.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}
                                            >
                                                {template.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setIsDeleting(template.id)}
                                                className="text-red-600 hover:text-red-700"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <AlertDialog open={!!isDeleting} onOpenChange={(open) => !open && setIsDeleting(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the email template.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => isDeleting && handleDelete(isDeleting)}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};
