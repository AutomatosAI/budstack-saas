import { redirect } from "next/navigation";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";

export default function FaqPage({ params }: { params: { slug: string } }) {
  redirect(`${getTenantBasePath(params.slug)}/support`);
}
