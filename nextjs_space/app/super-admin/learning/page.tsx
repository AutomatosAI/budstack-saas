import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { GraduationCap } from "lucide-react";
import { LearningManager } from "./learning-manager";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
      <div className="bs-page-header-centered">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          Learning Center
        </div>
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Manage Docs &amp; Guides
        </h1>
        <p className="bs-page-subtitle">
          Create and manage learning resources visible on the public site.
        </p>
      </div>

      <LearningManager
        initialResources={JSON.parse(JSON.stringify(resources))}
      />
    </div>
  );
}
