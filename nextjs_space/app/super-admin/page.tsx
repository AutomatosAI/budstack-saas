import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { OverviewPanel } from "@/components/admin/panels/OverviewPanel";

export default async function SuperAdminDashboard() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/sign-in");
  }

  // Get stats for overview panel
  const totalTenants = await prisma.tenants.count();
  const activeTenants = await prisma.tenants.count({
    where: { isActive: true },
  });
  const pendingOnboarding = await prisma.tenants.count({
    where: { isActive: false },
  });
  const totalUsers = await prisma.users.count();

  return (
    <OverviewPanel
      totalTenants={totalTenants}
      activeTenants={activeTenants}
      pendingOnboarding={pendingOnboarding}
      totalUsers={totalUsers}
    />
  );
}
