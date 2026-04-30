import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { GraduationCap } from "lucide-react";
import { LearningManager } from "./learning-manager";
import { AdminPageHeader } from "@/components/admin/shared";

export default async function LearningAdminPage() {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const resources = await prisma.learning_resources.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Learning Center"
        eyebrowIcon={GraduationCap}
        title="Manage Docs & Guides"
        subtitle="Create and manage learning resources visible on the public site."
      />

      <LearningManager initialResources={JSON.parse(JSON.stringify(resources))} />
    </div>
  );
}
