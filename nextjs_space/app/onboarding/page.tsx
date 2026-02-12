import { prisma } from "@/lib/db";
import OnboardingForm from "./onboarding-form";

import { getFileUrl } from "@/lib/s3";

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

  // Sign URLs for private assets
  const signedTemplates = await Promise.all(
    templates.map(async (t: {
      id: string;
      name: string;
      description: string | null;
      thumbnailUrl: string | null;
      previewUrl: string | null;
    }) => {
      let thumb = t.thumbnailUrl;
      let prev = t.previewUrl;

      if (thumb && !thumb.startsWith("http") && !thumb.startsWith("/")) {
        try {
          thumb = await getFileUrl(thumb);
        } catch (e) {
          console.error(`Failed to sign thumbnail for ${t.name}:`, e);
        }
      }

      if (prev && !prev.startsWith("http") && !prev.startsWith("/")) {
        try {
          prev = await getFileUrl(prev);
        } catch (e) {
          console.error(`Failed to sign preview for ${t.name}:`, e);
        }
      }

      return { ...t, thumbnailUrl: thumb, previewUrl: prev };
    })
  );

  return <OnboardingForm initialTemplates={signedTemplates} />;
}
