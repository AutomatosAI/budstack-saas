import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Settings } from "lucide-react";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/sign-in");
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
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Settings className="h-4 w-4" />
          Settings
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Store Settings
        </h1>
        <p className="mt-3 text-muted-foreground">
          Configure your store preferences and operations.
        </p>
      </div>

      <SettingsForm tenant={localUser.tenants} />
    </div>
  );
}
