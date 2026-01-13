import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TenantEditTemplateClient } from "./client";

export default async function TenantEditEmailPage({
  params,
}: {
  params: { id: string };
}) {
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

  const template = await prisma.email_templates.findFirst({
    where: {
      id: params.id,
      tenantId: user.tenants.id, // Strict ownership
    },
  });

  if (!template) {
    notFound();
  }

  // Convert Decimals/Dates if needed? Prisma usually fine for simple objects passed to client component.
  // Assuming simple fields.

  return <TenantEditTemplateClient template={template as any} />;
}
