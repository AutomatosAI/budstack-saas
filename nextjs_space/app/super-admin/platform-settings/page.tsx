import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import PlatformBrandingForm from "./platform-branding-form";

export default async function PlatformSettingsPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/sign-in");
  }

  // Get or create platform settings
  let settings = await prisma.platform_settings.findUnique({
    where: { id: "platform" },
  });

  if (!settings) {
    settings = await prisma.platform_settings.create({
      data: { id: "platform", updatedAt: new Date() },
    });
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Platform Branding
        </h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Customize the look and feel of the main BudStack platform
        </p>
      </div>

      {/* Branding Form */}
      <PlatformBrandingForm settings={settings} />
    </div>
  );
}
