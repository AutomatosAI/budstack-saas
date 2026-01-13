import { prisma } from "@/lib/db";
import OnboardingForm from "./onboarding-form";

// Force dynamic rendering to ensure fresh template data
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // Fetch active, public templates from the database
  const templates = await prisma.templates.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      thumbnailUrl: true,
      previewUrl: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return <OnboardingForm initialTemplates={templates} />;
}
