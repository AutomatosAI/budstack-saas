import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Settings } from "lucide-react";
import SettingsForm from "./settings-form";
import { AdminPageHeader } from "@/components/admin/shared";

export default async function SettingsPage() {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: { tenants: true },
  });

  // Mask the secret key before passing to client
  if (localUser?.tenants?.drGreenSecretKey) {
    localUser.tenants.drGreenSecretKey = "********";
  }
  if (localUser?.tenants?.drGreenApiKey) {
    localUser.tenants.drGreenApiKey = "********";
  }

  if (!localUser?.tenants) {
    redirect("/tenant-admin");
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Settings"
        eyebrowIcon={Settings}
        title="Store Settings"
        subtitle="Configure your store preferences and operations."
      />

      <SettingsForm tenant={localUser.tenants} />
    </div>
  );
}
