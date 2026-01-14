import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PlatformBrandingForm from "./platform-branding-form";

export default async function PlatformSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !session?.user?.id) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
  });

  if (user?.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
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
