'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GooglePreview } from './GooglePreview';
import { ImageIcon, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface SeoData {
    title?: string;
    description?: string;
    ogImage?: string;
}

interface SeoEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityType: 'product' | 'post' | 'page' | 'condition';
    entityId: string;
    entityName: string;
    entitySlug: string;
    previewUrl: string;
    initialSeo?: SeoData;
    onSave: (seo: SeoData) => Promise<void>;
}

export function SeoEditorModal({
    isOpen,
    onClose,
    entityType,
    entityId,
    entityName,
    entitySlug,
    previewUrl,
    initialSeo,
    onSave,
}: SeoEditorModalProps) {
    const [title, setTitle] = useState(initialSeo?.title || '');
    const [description, setDescription] = useState(initialSeo?.description || '');
    const [ogImage, setOgImage] = useState(initialSeo?.ogImage || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setTitle(initialSeo?.title || '');
        setDescription(initialSeo?.description || '');
        setOgImage(initialSeo?.ogImage || '');
    }, [initialSeo, isOpen]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ title, description, ogImage });
            toast.success('SEO settings saved successfully');
            onClose();
        } catch (error) {
            toast.error('Failed to save SEO settings');
            console.error('SEO save error:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        SEO Settings: {entityName}
                    </DialogTitle>
                    <p className="text-sm text-slate-500">
                        Customize how this {entityType} appears in search engines and social media.
                    </p>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Google Preview */}
                    <GooglePreview
                        title={title || entityName}
                        description={description || `Learn more about ${entityName}`}
                        url={previewUrl}
                    />

                    {/* Meta Title */}
                    <div className="space-y-2">
                        <Label htmlFor="seo-title">
                            Meta Title
                            <span className="text-xs text-slate-500 ml-2">({title.length}/60 recommended)</span>
                        </Label>
                        <Input
                            id="seo-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={entityName}
                            className={title.length > 60 ? 'border-orange-400' : ''}
                        />
                        <p className="text-xs text-slate-500">
                            Leave empty to use: "{entityName}"
                        </p>
                    </div>

                    {/* Meta Description */}
                    <div className="space-y-2">
                        <Label htmlFor="seo-description">
                            Meta Description
                            <span className="text-xs text-slate-500 ml-2">({description.length}/160 recommended)</span>
                        </Label>
                        <Textarea
                            id="seo-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={`Learn more about ${entityName}...`}
                            rows={3}
                            className={description.length > 160 ? 'border-orange-400' : ''}
                        />
                    </div>

                    {/* OG Image */}
                    <div className="space-y-2">
                        <Label htmlFor="seo-og-image">
                            Open Graph Image
                            <span className="text-xs text-slate-500 ml-2">(1200x630 recommended)</span>
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="seo-og-image"
                                value={ogImage}
                                onChange={(e) => setOgImage(e.target.value)}
                                placeholder="https://example.com/image.jpg"
                                className="flex-1"
                            />
                            <Button variant="outline" size="icon" disabled>
                                <ImageIcon className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500">
                            Enter image URL or upload (upload coming soon)
                        </p>
                        {ogImage && (
                            <div className="mt-2 border rounded-lg overflow-hidden">
                                <img
                                    src={ogImage}
                                    alt="OG Preview"
                                    className="w-full h-32 object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="10" y="30" fill="gray">Invalid Image</text></svg>';
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save SEO Settings
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
