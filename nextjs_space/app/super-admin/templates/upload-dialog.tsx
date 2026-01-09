'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Github, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useRouter } from 'next/navigation';

export function UploadTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [structureType, setStructureType] = useState<'default' | 'lovable'>('default');
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!githubUrl.trim()) {
      toast.error('Please enter a GitHub URL');
      return;
    }

    setIsUploading(true);

    console.log('[Template Upload] Starting upload...');
    console.log('[Template Upload] GitHub URL:', githubUrl.trim());
    console.log('[Template Upload] Structure Type:', structureType);

    try {
      console.log('[Template Upload] Sending POST request...');

      const response = await fetch('/api/super-admin/templates/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateName: templateName.trim(),
          githubUrl: githubUrl.trim(),
          structureType
        }),
      });

      console.log('[Template Upload] Response status:', response.status, response.statusText);
      console.log('[Template Upload] Response headers:', Object.fromEntries(response.headers.entries()));

      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        console.log('[Template Upload] Response data:', data);
      } else {
        const text = await response.text();
        console.error('[Template Upload] Non-JSON response:', text.substring(0, 500));
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        const errorMsg = data.error || data.message || 'Failed to upload template';
        console.error('[Template Upload] Upload failed:', errorMsg);
        if (data.details) {
          console.error('[Template Upload] Error details:', data.details);
        }
        throw new Error(errorMsg);
      }

      console.log('[Template Upload] Upload successful!');
      toast.success(data.message || 'Template uploaded successfully!');
      setOpen(false);
      setTemplateName('');
      setGithubUrl('');
      setStructureType('default');
      router.refresh();
    } catch (error: any) {
      console.error('[Template Upload] ERROR:', error);
      console.error('[Template Upload] Error stack:', error.stack);

      // Show detailed error to user
      const errorMessage = error.message || 'Failed to upload template';
      toast.error(errorMessage);

      // Also log for debugging
      console.error('[Template Upload] Full error object:', error);
    } finally {
      setIsUploading(false);
      console.log('[Template Upload] Upload process completed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
          <Plus className="mr-2 h-4 w-4" />
          Upload New Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Template from GitHub</DialogTitle>
          <DialogDescription>
            Select the template structure type and enter the GitHub repository URL.
            {structureType === 'default' && (
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>template.config.json</li>
                <li>index.tsx</li>
                <li>defaults.json (recommended)</li>
                <li>components/ directory</li>
                <li>styles.css (optional)</li>
              </ul>
            )}
            {structureType === 'lovable' && (
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Will be automatically converted to BudStack format</li>
                <li>Supports full Lovable.dev project structure</li>
                <li>Converts React Router to Next.js</li>
                <li>Extracts homepage components</li>
              </ul>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="structure-type">Template Structure</Label>
            <Select value={structureType} onValueChange={(value: 'default' | 'lovable') => setStructureType(value)}>
              <SelectTrigger id="structure-type">
                <SelectValue placeholder="Select template structure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Default (BudStack)</span>
                    <span className="text-xs text-gray-500">Already follows BudStack structure</span>
                  </div>
                </SelectItem>
                <SelectItem value="lovable">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Lovable.dev Template</span>
                    <span className="text-xs text-gray-500">Will be automatically converted</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name">
              Template Name
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., Portugal Wellness, Miami Vice Theme, etc."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500">
              Give your template a unique, descriptive name (e.g., "Portugal Wellness", "GTA Vice City").
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="github-url">
              <Github className="inline-block w-4 h-4 mr-1" />
              GitHub Repository URL
            </Label>
            <Input
              id="github-url"
              placeholder="https://github.com/username/template-repo.git"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500">
              Example: https://github.com/Gerard161-Site/healingbuds-template.git
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
