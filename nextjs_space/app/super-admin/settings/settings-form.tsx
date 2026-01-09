
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

interface SettingsFormProps {
    config: {
        id: string;
        drGreenApiUrl: string | null;
        awsBucketName: string | null;
        awsFolderPrefix: string | null;
        awsRegion: string | null;
        awsAccessKeyId: string;
        awsSecretAccessKey: string;
        emailServer: string;
        emailFrom: string | null;
        redisUrl: string;
    };
}

export default function SettingsForm({ config }: SettingsFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        drGreenApiUrl: config.drGreenApiUrl || '',
        awsBucketName: config.awsBucketName || '',
        awsFolderPrefix: config.awsFolderPrefix || '',
        awsRegion: config.awsRegion || '',
        awsAccessKeyId: '', // Always start empty for security
        awsSecretAccessKey: '', // Always start empty for security
        emailServer: '', // Always start empty for security
        emailFrom: config.emailFrom || '',
        redisUrl: '', // Always start empty for security
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await fetch(`/api/super-admin/settings`, {
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
            <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                    These settings override environment variables. Sensitive fields are encrypted before storage.
                    Leave encrypted fields empty to keep existing values.
                </AlertDescription>
            </Alert>

            {/* Dr. Green API */}
            <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50">
                    <CardTitle>Dr. Green API Configuration</CardTitle>
                    <CardDescription>Configure the default Dr. Green API endpoint</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div>
                        <Label htmlFor="drGreenApiUrl">API URL</Label>
                        <Input
                            id="drGreenApiUrl"
                            value={formData.drGreenApiUrl}
                            onChange={(e) => setFormData({ ...formData, drGreenApiUrl: e.target.value })}
                            placeholder="https://stage-api.drgreennft.com/api/v1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Default API endpoint for all tenants (can be overridden per tenant)
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* AWS S3 Configuration */}
            <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
                    <CardTitle>AWS S3 Configuration</CardTitle>
                    <CardDescription>Configure file storage settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div>
                        <Label htmlFor="awsBucketName">Bucket Name</Label>
                        <Input
                            id="awsBucketName"
                            value={formData.awsBucketName}
                            onChange={(e) => setFormData({ ...formData, awsBucketName: e.target.value })}
                            placeholder="budstack-uploads"
                        />
                    </div>
                    <div>
                        <Label htmlFor="awsRegion">Region</Label>
                        <Input
                            id="awsRegion"
                            value={formData.awsRegion}
                            onChange={(e) => setFormData({ ...formData, awsRegion: e.target.value })}
                            placeholder="eu-west-1"
                        />
                    </div>
                    <div>
                        <Label htmlFor="awsFolderPrefix">Folder Prefix</Label>
                        <Input
                            id="awsFolderPrefix"
                            value={formData.awsFolderPrefix}
                            onChange={(e) => setFormData({ ...formData, awsFolderPrefix: e.target.value })}
                            placeholder="development/"
                        />
                    </div>
                    <div>
                        <Label htmlFor="awsAccessKeyId">Access Key ID (Encrypted)</Label>
                        <Input
                            id="awsAccessKeyId"
                            type="password"
                            value={formData.awsAccessKeyId}
                            onChange={(e) => setFormData({ ...formData, awsAccessKeyId: e.target.value })}
                            placeholder={config.awsAccessKeyId ? "******** (Existing)" : "Enter new access key"}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {config.awsAccessKeyId ? "Leave empty to keep existing key." : "Required for file uploads."}
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="awsSecretAccessKey">Secret Access Key (Encrypted)</Label>
                        <Input
                            id="awsSecretAccessKey"
                            type="password"
                            value={formData.awsSecretAccessKey}
                            onChange={(e) => setFormData({ ...formData, awsSecretAccessKey: e.target.value })}
                            placeholder={config.awsSecretAccessKey ? "******** (Existing)" : "Enter new secret key"}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {config.awsSecretAccessKey ? "Leave empty to keep existing secret." : "Required for file uploads."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Email Configuration */}
            <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardTitle>Email Configuration</CardTitle>
                    <CardDescription>Configure SMTP settings for sending emails</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div>
                        <Label htmlFor="emailServer">SMTP Server URL (Encrypted)</Label>
                        <Input
                            id="emailServer"
                            type="password"
                            value={formData.emailServer}
                            onChange={(e) => setFormData({ ...formData, emailServer: e.target.value })}
                            placeholder={config.emailServer ? "******** (Existing)" : "smtp://user:password@smtp.sendgrid.net:587"}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {config.emailServer ? "Leave empty to keep existing server." : "Full SMTP connection string with credentials."}
                        </p>
                    </div>
                    <div>
                        <Label htmlFor="emailFrom">From Email Address</Label>
                        <Input
                            id="emailFrom"
                            value={formData.emailFrom}
                            onChange={(e) => setFormData({ ...formData, emailFrom: e.target.value })}
                            placeholder="noreply@budstack.io"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Redis Configuration */}
            <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
                    <CardTitle>Redis Configuration</CardTitle>
                    <CardDescription>Configure Redis for caching and sessions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div>
                        <Label htmlFor="redisUrl">Redis Connection URL (Encrypted)</Label>
                        <Input
                            id="redisUrl"
                            type="password"
                            value={formData.redisUrl}
                            onChange={(e) => setFormData({ ...formData, redisUrl: e.target.value })}
                            placeholder={config.redisUrl ? "******** (Existing)" : "redis://redis:6379"}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {config.redisUrl ? "Leave empty to keep existing URL." : "Redis connection string."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end">
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all"
                >
                    {isLoading ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </form>
    );
}
