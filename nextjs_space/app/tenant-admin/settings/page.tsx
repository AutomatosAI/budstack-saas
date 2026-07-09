import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  await requirePagePermission("canEditSettings");
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
      <header className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Store Settings
        </h1>
        <p className="bs-page-subtitle">
          Configure your store preferences and operations.
        </p>
      </header>

      <SettingsForm tenant={localUser.tenants} />
    </div>
  );
}
