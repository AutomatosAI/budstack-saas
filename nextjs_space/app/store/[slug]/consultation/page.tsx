import { ConsultationForm } from "@/components/consultation/consultation-form";
import { notFound } from "next/navigation";

export default async function ConsultationPage({
  params,
}: {
  params: { slug: string };
}) {
  // Validate tenant exists
  const response = await fetch(
    `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/tenant/${params.slug}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    notFound();
  }

  const { tenant } = await response.json();

  return (
    <div
      className="pt-20 pb-16"
      style={{
        backgroundColor: "var(--tenant-color-surface, #f9fafb)",
        fontFamily: "var(--tenant-font-base, inherit)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1
              className="text-4xl md:text-5xl font-bold mb-8"
              style={{
                color: "var(--tenant-color-heading, #111827)",
                fontFamily: "var(--tenant-font-heading, inherit)",
              }}
            >
              Medical Cannabis Consultation
            </h1>
            <p
              className="text-lg md:text-xl"
              style={{ color: "var(--tenant-color-text, #1f2937)" }}
            >
              Complete this questionnaire to begin your journey towards medical
              cannabis treatment
            </p>
          </div>

          <ConsultationForm tenantSlug={params.slug} tenantId={tenant.id} />
        </div>
      </div>
    </div>
  );
}
