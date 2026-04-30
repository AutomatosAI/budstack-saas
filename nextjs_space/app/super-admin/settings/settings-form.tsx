"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { InfoIcon, Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
    awsAccessKeyId: "",
    awsSecretAccessKey: "",
    emailServer: "",
    emailFrom: config.emailFrom || "",
    redisUrl: "",
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
        toast.success("Test email sent successfully");
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
      <div className="bs-card bs-card-pad flex items-start gap-3 bg-bs-info/10 border-bs-info/30">
        <InfoIcon
          className="h-5 w-5 text-bs-info flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p className="text-sm text-bs-fg">
          These settings override environment variables. Sensitive fields are
          encrypted before storage. Leave encrypted fields empty to keep
          existing values.
        </p>
      </div>

      {/* Dr. Green API */}
      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h3
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Dr. Green API Configuration
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Configure the default Dr. Green API endpoint
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drGreenApiUrl" className="text-bs-fg">
            API URL
          </Label>
          <Input
            id="drGreenApiUrl"
            value={formData.drGreenApiUrl}
            onChange={(e) =>
              setFormData({ ...formData, drGreenApiUrl: e.target.value })
            }
            placeholder="https://stage-api.drgreennft.com/api/v1"
          />
          <p className="text-xs text-bs-fg-muted">
            Default API endpoint for all tenants (can be overridden per tenant)
          </p>
        </div>
      </section>

      {/* AWS S3 Configuration */}
      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h3
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            AWS S3 Configuration
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Configure file storage settings
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="awsBucketName" className="text-bs-fg">
            Bucket Name
          </Label>
          <Input
            id="awsBucketName"
            value={formData.awsBucketName}
            onChange={(e) =>
              setFormData({ ...formData, awsBucketName: e.target.value })
            }
            placeholder="budstack-uploads"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awsRegion" className="text-bs-fg">
            Region
          </Label>
          <Input
            id="awsRegion"
            value={formData.awsRegion}
            onChange={(e) =>
              setFormData({ ...formData, awsRegion: e.target.value })
            }
            placeholder="eu-west-1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awsFolderPrefix" className="text-bs-fg">
            Folder Prefix
          </Label>
          <Input
            id="awsFolderPrefix"
            value={formData.awsFolderPrefix}
            onChange={(e) =>
              setFormData({ ...formData, awsFolderPrefix: e.target.value })
            }
            placeholder="development/"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="awsAccessKeyId" className="text-bs-fg">
            Access Key ID (Encrypted)
          </Label>
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
          <p className="text-xs text-bs-fg-muted">
            {config.awsAccessKeyId
              ? "Leave empty to keep existing key."
              : "Required for file uploads."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="awsSecretAccessKey" className="text-bs-fg">
            Secret Access Key (Encrypted)
          </Label>
          <Input
            id="awsSecretAccessKey"
            type="password"
            value={formData.awsSecretAccessKey}
            onChange={(e) =>
              setFormData({
                ...formData,
                awsSecretAccessKey: e.target.value,
              })
            }
            placeholder={
              config.awsSecretAccessKey
                ? "******** (Existing)"
                : "Enter new secret key"
            }
          />
          <p className="text-xs text-bs-fg-muted">
            {config.awsSecretAccessKey
              ? "Leave empty to keep existing secret."
              : "Required for file uploads."}
          </p>
        </div>
      </section>

      {/* Email Configuration */}
      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h3
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Email Configuration
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Configure SMTP settings for sending emails
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emailServer" className="text-bs-fg">
            SMTP Server URL (Encrypted)
          </Label>
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
          <p className="text-xs text-bs-fg-muted">
            {config.emailServer
              ? "Leave empty to keep existing server."
              : "Full SMTP connection string with credentials."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emailFrom" className="text-bs-fg">
            From Email Address
          </Label>
          <Input
            id="emailFrom"
            value={formData.emailFrom}
            onChange={(e) =>
              setFormData({ ...formData, emailFrom: e.target.value })
            }
            placeholder="noreply@budstack.io"
          />
        </div>

        {config.emailServer && (
          <div className="mt-2 p-4 rounded-bs-md bg-bs-card-2/50 border border-bs-border-100">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-bs-info" aria-hidden="true" />
              <span className="font-medium text-bs-fg">
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
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={isTestingSmtp || !testEmail}
                className="bs-btn bs-btn-ghost"
              >
                {isTestingSmtp ? (
                  <>
                    <Loader2
                      className="w-4 h-4 mr-2 animate-spin"
                      aria-hidden="true"
                    />
                    Testing...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" aria-hidden="true" />
                    Send Test
                  </>
                )}
              </button>
            </div>
            {smtpTestResult && (
              <div
                className={`mt-3 p-3 rounded-bs-sm flex items-start gap-2 ${
                  smtpTestResult.success
                    ? "bg-bs-green/10 border border-bs-green/30"
                    : "bg-bs-danger/10 border border-bs-danger/30"
                }`}
              >
                {smtpTestResult.success ? (
                  <CheckCircle2
                    className="w-5 h-5 flex-shrink-0 mt-0.5 text-bs-green"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="w-5 h-5 flex-shrink-0 mt-0.5 text-bs-danger"
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm text-bs-fg">
                  {smtpTestResult.message}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Redis Configuration */}
      <section className="bs-card bs-card-pad space-y-4">
        <div>
          <h3
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Redis Configuration
          </h3>
          <p className="text-sm text-bs-fg-muted">
            Configure Redis for caching and sessions
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="redisUrl" className="text-bs-fg">
            Redis Connection URL (Encrypted)
          </Label>
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
          <p className="text-xs text-bs-fg-muted">
            {config.redisUrl
              ? "Leave empty to keep existing URL."
              : "Redis connection string."}
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="bs-btn bs-btn-green"
        >
          {isLoading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>
  );
}
