import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TenantNewTemplateClient } from "./client";

export default async function TenantNewEmailPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
  ) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { tenants: true },
  });

  if (!user?.tenants) {
    redirect("/tenant-admin");
  }

  return <TenantNewTemplateClient />;
}
