import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import ContactClient from "./contact-client";

export default async function ContactPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);

  if (!tenant) {
    notFound();
  }

  return <ContactClient tenant={tenant} />;
}
