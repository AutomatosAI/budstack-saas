import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Settings } from "lucide-react";
import SettingsForm from "./settings-form";

export default async function PlatformSettingsConfigPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  let config = await prisma.platform_config.findUnique({
    where: { id: "config" },
  });

  if (!config) {
    config = await prisma.platform_config.create({
      data: { id: "config" },
    });
  }

  const maskedConfig = {
    ...config,
    awsAccessKeyId: config.awsAccessKeyId ? "********" : "",
    awsSecretAccessKey: config.awsSecretAccessKey ? "********" : "",
    emailServer: config.emailServer ? "********" : "",
    redisUrl: config.redisUrl ? "********" : "",
  };

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Configuration
        </div>
        <h1 className="bs-page-title">Platform Settings</h1>
        <p className="bs-page-subtitle">
          Manage environment variables and system configuration.
        </p>
      </div>

      <SettingsForm config={maskedConfig} />
    </div>
  );
}
