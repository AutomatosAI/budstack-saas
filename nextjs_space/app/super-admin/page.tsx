import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OverviewPanel } from "@/components/admin/panels/OverviewPanel";

export default async function SuperAdminDashboard() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
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
