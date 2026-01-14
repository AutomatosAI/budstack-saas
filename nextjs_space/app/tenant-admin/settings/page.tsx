import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Settings } from "lucide-react";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    (session.user.role !== "TENANT_ADMIN" &&
      session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { tenants: true },
  });

  // Mask the secret key before passing to client
  if (user?.tenants?.drGreenSecretKey) {
    user.tenants.drGreenSecretKey = "********";
  }
  if (user?.tenants?.drGreenApiKey) {
    user.tenants.drGreenApiKey = "********";
  }

  if (!user?.tenants) {
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

      <SettingsForm tenant={user.tenants} />
    </div>
  );
}
