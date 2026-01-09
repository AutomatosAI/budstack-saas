'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import Tiptap from '@/components/editor/tiptap';
import { toast } from '@/components/ui/sonner';
import Link from 'next/link';
import { ArrowLeft, Upload, X, Loader2 } from 'lucide-react';

const postSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    excerpt: z.string().optional(),
    coverImage: z.string().optional(),
    published: z.boolean().default(false),
});

type PostFormData = z.infer<typeof postSchema>;

interface PostFormProps {
    initialData?: PostFormData & { id?: string };
    isEditing?: boolean;
}

export default function PostForm({ initialData, isEditing = false }: PostFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/tenant-admin/upload', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            form.setValue('coverImage', data.url);
            toast.success('Image uploaded');
        } catch (error) {
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const form = useForm<PostFormData>({
        resolver: zodResolver(postSchema),
        defaultValues: initialData || {
            title: '',
            content: '',
            excerpt: '',
            coverImage: '',
            published: false,
        },
    });

    const onSubmit = async (data: PostFormData) => {
        setIsLoading(true);
        try {
            const url = isEditing && initialData?.id
                ? `/api/tenant-admin/posts/${initialData.id}`
                : '/api/tenant-admin/posts';

            const method = isEditing ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Something went wrong');
            }

            toast.success(isEditing ? 'Article updated' : 'Article created');
            router.push('/tenant-admin/the-wire');
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {isEditing ? 'Edit Article' : 'New Article'}
                </h1>
                <p className="text-slate-600 mt-2">
                    {isEditing ? 'Update your article content and settings' : 'Create a new article for The Wire'}
                </p>
            </div>

            <div className="max-w-5xl">
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid gap-6">

                        <Card>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        {...form.register('title')}
                                        placeholder="Article Title"
                                    />
                                    {form.formState.errors.title && (
                                        <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="excerpt">Excerpt</Label>
                                    <Textarea
                                        id="excerpt"
                                        {...form.register('excerpt')}
                                        placeholder="Short summary for preview cards..."
                                        className="h-20"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="coverImage">Cover Image</Label>
                                    <div className="flex flex-col gap-4">
                                        {form.watch('coverImage') && (
                                            <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border">
                                                <img
                                                    src={form.watch('coverImage')}
                                                    alt="Cover preview"
                                                    className="object-cover w-full h-full"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-2 right-2 h-6 w-6"
                                                    onClick={() => form.setValue('coverImage', '')}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="coverImage"
                                                {...form.register('coverImage')}
                                                placeholder="https://... or upload image"
                                                className="flex-1"
                                            />
                                            <div className="relative">
                                                <Button type="button" variant="outline" size="icon" disabled={isUploading}>
                                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                </Button>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    disabled={isUploading}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Paste a URL or click the upload icon to select a file.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <Label>Content</Label>
                                    <Tiptap
                                        content={form.getValues('content')}
                                        onChange={(html) => form.setValue('content', html, { shouldValidate: true })}
                                    />
                                    {form.formState.errors.content && (
                                        <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Publish Status</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {form.watch('published') ? 'Article is live' : 'Article is saved as draft'}
                                    </p>
                                </div>
                                <Switch
                                    checked={form.watch('published')}
                                    onCheckedChange={(checked) => form.setValue('published', checked)}
                                />
                            </CardContent>
                        </Card>

                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <Link href="/tenant-admin/the-wire">
                            <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                        >
                            {isLoading ? 'Saving...' : (isEditing ? 'Update Article' : 'Create Article')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
