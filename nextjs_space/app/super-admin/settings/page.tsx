import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Settings } from "lucide-react";
import SettingsForm from "./settings-form";

export default async function PlatformSettingsConfigPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/sign-in");
  }

  // Get or create platform config
  let config = await prisma.platform_config.findUnique({
    where: { id: "config" },
  });

  if (!config) {
    config = await prisma.platform_config.create({
      data: { id: "config" },
    });
  }

  // Mask sensitive fields before sending to client
  const maskedConfig = {
    ...config,
    awsAccessKeyId: config.awsAccessKeyId ? "********" : "",
    awsSecretAccessKey: config.awsSecretAccessKey ? "********" : "",
    emailServer: config.emailServer ? "********" : "",
    redisUrl: config.redisUrl ? "********" : "",
  };

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Settings className="h-4 w-4" />
          Configuration
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Platform Settings
        </h1>
        <p className="mt-3 text-muted-foreground">
          Manage environment variables and system configuration.
        </p>
      </div>

      {/* Settings Form */}
      <SettingsForm config={maskedConfig} />
    </div>
  );
}
