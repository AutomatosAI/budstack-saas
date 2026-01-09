
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';

interface SettingsFormProps {
  tenant: {
    id: string;
    subdomain: string;
    customDomain: string | null;
    nftTokenId: string | null;
    drGreenApiUrl?: string | null;
    drGreenApiKey?: string | null;
    drGreenSecretKey?: string | null;
  };
}

export default function SettingsForm({ tenant }: SettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customDomain: tenant.customDomain || '',
    drGreenApiUrl: tenant.drGreenApiUrl || '',
    drGreenApiKey: tenant.drGreenApiKey || '',
    drGreenSecretKey: '', // Always start empty for security
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/tenant-admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Failed to update settings');

      toast.success('Settings updated successfully');
      router.refresh();
    } catch (error) {
      toast.error('Failed to update settings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Domain Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Configuration</CardTitle>
          <CardDescription>Manage your store's domain settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Subdomain</Label>
            <div className="flex items-center mt-2">
              <Input value={tenant.subdomain} disabled className="flex-1" />
              <span className="ml-2 text-gray-500">.budstack.to</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">This is your permanent subdomain</p>
          </div>
          <div>
            <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
            <Input
              id="customDomain"
              value={formData.customDomain}
              onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
              placeholder="yourdispensary.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Contact support after adding a custom domain for DNS configuration
            </p>
          </div>
        </CardContent>
      </Card>

      {/* NFT Information */}
      <Card>
        <CardHeader>
          <CardTitle>NFT License</CardTitle>
          <CardDescription>Your store license information</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label>NFT Token ID</Label>
            <Input value={tenant.nftTokenId || 'Not set'} disabled className="mt-2" />
            <p className="text-xs text-gray-500 mt-1">
              This NFT verifies your license to operate on BudStack.io
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Dr. Green Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Dr. Green Integration</CardTitle>
          <CardDescription>Configure your connection to the Dr. Green API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="drGreenApiKey">API Key</Label>
            <Input
              id="drGreenApiKey"
              value={formData.drGreenApiKey}
              onChange={(e) => setFormData({ ...formData, drGreenApiKey: e.target.value })}
              placeholder="Paste your Public Key here"
            />
          </div>
          <div>
            <Label htmlFor="drGreenSecretKey">Secret Key</Label>
            <Input
              id="drGreenSecretKey"
              type="password"
              value={formData.drGreenSecretKey}
              onChange={(e) => setFormData({ ...formData, drGreenSecretKey: e.target.value })}
              placeholder={tenant.drGreenSecretKey ? "******** (Verified)" : "Paste your Private Key here"}
            />
            <p className="text-xs text-gray-500 mt-1">
              {tenant.drGreenSecretKey ? "Leave empty to keep existing secret." : "Required for submitting consultations."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
