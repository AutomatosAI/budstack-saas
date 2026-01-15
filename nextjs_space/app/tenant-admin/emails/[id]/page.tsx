import { currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { TenantEditTemplateClient } from "./client";

export default async function TenantEditEmailPage({
  params,
}: {
  params: { id: string };
}) {
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

  const template = await prisma.email_templates.findFirst({
    where: {
      id: params.id,
      tenantId: localUser.tenants.id, // Strict ownership
    }, // Strict ownership
  });

  if (!template) {
    notFound();
  }

  // Convert Decimals/Dates if needed? Prisma usually fine for simple objects passed to client component.
  // Assuming simple fields.

  return <TenantEditTemplateClient template={template as any} />;
}
