"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";

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
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [smtpTestResult, setSmtpTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    drGreenApiUrl: config.drGreenApiUrl || "",
    awsBucketName: config.awsBucketName || "",
    awsFolderPrefix: config.awsFolderPrefix || "",
    awsRegion: config.awsRegion || "",
    awsAccessKeyId: "", // Always start empty for security
    awsSecretAccessKey: "", // Always start empty for security
    emailServer: "", // Always start empty for security
    emailFrom: config.emailFrom || "",
    redisUrl: "", // Always start empty for security
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/super-admin/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      toast.success("Settings updated successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to update settings");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    setIsTestingSmtp(true);
    setSmtpTestResult(null);

    try {
      const res = await fetch("/api/super-admin/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });

      const data = await res.json();

      if (data.success) {
        setSmtpTestResult({ success: true, message: data.message });
        toast.success("Test email sent successfully!");
      } else {
        setSmtpTestResult({ success: false, message: data.error });
        toast.error(data.error);
      }
    } catch (error: any) {
      setSmtpTestResult({ success: false, message: error.message });
      toast.error("Failed to test SMTP connection");
    } finally {
      setIsTestingSmtp(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          These settings override environment variables. Sensitive fields are
          encrypted before storage. Leave encrypted fields empty to keep
          existing values.
        </AlertDescription>
      </Alert>

      {/* Dr. Green API */}
      <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Dr. Green API Configuration</CardTitle>
          <CardDescription>
            Configure the default Dr. Green API endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="drGreenApiUrl">API URL</Label>
            <Input
              id="drGreenApiUrl"
              value={formData.drGreenApiUrl}
              onChange={(e) =>
                setFormData({ ...formData, drGreenApiUrl: e.target.value })
              }
              placeholder="https://stage-api.drgreennft.com/api/v1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default API endpoint for all tenants (can be overridden per
              tenant)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AWS S3 Configuration */}
      <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>AWS S3 Configuration</CardTitle>
          <CardDescription>Configure file storage settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="awsBucketName">Bucket Name</Label>
            <Input
              id="awsBucketName"
              value={formData.awsBucketName}
              onChange={(e) =>
                setFormData({ ...formData, awsBucketName: e.target.value })
              }
              placeholder="budstack-uploads"
            />
          </div>
          <div>
            <Label htmlFor="awsRegion">Region</Label>
            <Input
              id="awsRegion"
              value={formData.awsRegion}
              onChange={(e) =>
                setFormData({ ...formData, awsRegion: e.target.value })
              }
              placeholder="eu-west-1"
            />
          </div>
          <div>
            <Label htmlFor="awsFolderPrefix">Folder Prefix</Label>
            <Input
              id="awsFolderPrefix"
              value={formData.awsFolderPrefix}
              onChange={(e) =>
                setFormData({ ...formData, awsFolderPrefix: e.target.value })
              }
              placeholder="development/"
            />
          </div>
          <div>
            <Label htmlFor="awsAccessKeyId">Access Key ID (Encrypted)</Label>
            <Input
              id="awsAccessKeyId"
              type="password"
              value={formData.awsAccessKeyId}
              onChange={(e) =>
                setFormData({ ...formData, awsAccessKeyId: e.target.value })
              }
              placeholder={
                config.awsAccessKeyId
                  ? "******** (Existing)"
                  : "Enter new access key"
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {config.awsAccessKeyId
                ? "Leave empty to keep existing key."
                : "Required for file uploads."}
            </p>
          </div>
          <div>
            <Label htmlFor="awsSecretAccessKey">
              Secret Access Key (Encrypted)
            </Label>
            <Input
              id="awsSecretAccessKey"
              type="password"
              value={formData.awsSecretAccessKey}
              onChange={(e) =>
                setFormData({ ...formData, awsSecretAccessKey: e.target.value })
              }
              placeholder={
                config.awsSecretAccessKey
                  ? "******** (Existing)"
                  : "Enter new secret key"
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {config.awsSecretAccessKey
                ? "Leave empty to keep existing secret."
                : "Required for file uploads."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Email Configuration</CardTitle>
          <CardDescription>
            Configure SMTP settings for sending emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="emailServer">SMTP Server URL (Encrypted)</Label>
            <Input
              id="emailServer"
              type="password"
              value={formData.emailServer}
              onChange={(e) =>
                setFormData({ ...formData, emailServer: e.target.value })
              }
              placeholder={
                config.emailServer
                  ? "******** (Existing)"
                  : "smtp://user:password@smtp.sendgrid.net:587"
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {config.emailServer
                ? "Leave empty to keep existing server."
                : "Full SMTP connection string with credentials."}
            </p>
          </div>
          <div>
            <Label htmlFor="emailFrom">From Email Address</Label>
            <Input
              id="emailFrom"
              value={formData.emailFrom}
              onChange={(e) =>
                setFormData({ ...formData, emailFrom: e.target.value })
              }
              placeholder="noreply@budstack.io"
            />
          </div>

          {/* Test SMTP Section */}
          {config.emailServer && (
            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-900">
                  Test SMTP Configuration
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter your email to receive test"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={isTestingSmtp || !testEmail}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-100"
                >
                  {isTestingSmtp ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
              {smtpTestResult && (
                <div
                  className={`mt-3 p-3 rounded-md flex items-start gap-2 ${smtpTestResult.success
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                    }`}
                >
                  {smtpTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="text-sm">{smtpTestResult.message}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redis Configuration */}
      <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Redis Configuration</CardTitle>
          <CardDescription>
            Configure Redis for caching and sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label htmlFor="redisUrl">Redis Connection URL (Encrypted)</Label>
            <Input
              id="redisUrl"
              type="password"
              value={formData.redisUrl}
              onChange={(e) =>
                setFormData({ ...formData, redisUrl: e.target.value })
              }
              placeholder={
                config.redisUrl ? "******** (Existing)" : "redis://redis:6379"
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {config.redisUrl
                ? "Leave empty to keep existing URL."
                : "Redis connection string."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all"
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
