import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { GraduationCap } from "lucide-react";
import { LearningManager } from "./learning-manager";

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
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <GraduationCap className="h-4 w-4" />
          Learning Center
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Manage Docs & Guides
        </h1>
        <p className="mt-3 text-muted-foreground">
          Create and manage learning resources visible on the public site.
        </p>
      </div>

      <LearningManager initialResources={JSON.parse(JSON.stringify(resources))} />
    </div>
  );
}
