import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/db";
import PlatformBrandingForm from "./platform-branding-form";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function PlatformSettingsPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  let settings = await prisma.platform_settings.findUnique({
    where: { id: "platform" },
  });

  if (!settings) {
    settings = await prisma.platform_settings.create({
      data: { id: "platform", updatedAt: new Date() },
    });
  }

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <Settings className="h-4 w-4" aria-hidden="true" />
          Platform Settings
        </div>
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Platform Branding
        </h1>
        <p className="bs-page-subtitle">
          Customize the look and feel of the main BudStacks platform.
        </p>
      </div>

      <PlatformBrandingForm settings={settings} />
    </div>
  );
}
