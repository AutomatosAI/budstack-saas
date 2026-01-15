import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TenantNewTemplateClient } from "./client";

export default async function TenantNewEmailPage() {
  const user = await currentUser();

  if (
    !user ||
    !["TENANT_ADMIN", "SUPER_ADMIN"].includes((user.publicMetadata.role as string) || "")
  ) {
    redirect("/sign-in");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: { tenants: true },
  });

  if (!localUser?.tenants) {
    redirect("/tenant-admin");
  }

  return <TenantNewTemplateClient />;
}
