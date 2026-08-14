import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { getTenantPlan } from "@/lib/entitlements/require-feature";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import PostForm from "../post-form";

export const metadata = {
  title: "Edit Article | The Wire",
};

export default async function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const { id } = params;

  // US-021: the plan decides which sentence the URL warning shows — a 301 is
  // written for Pro, nothing is for Basic. Read alongside the post rather than
  // after it; `getTenantPlan` fails closed to Basic, so a lookup that throws
  // shows the honest "the old URL will 404" warning rather than promising a
  // redirect the PATCH route will not write.
  const [post, plan] = await Promise.all([
    prisma.posts.findUnique({ where: { id } }),
    getTenantPlan(active.tenantId),
  ]);

  if (!post) {
    notFound();
  }

  // Verify tenant access against the active (impersonation-aware) tenant.
  if (post.tenantId !== active.tenantId) {
    redirect("/tenant-admin/the-wire");
  }

  return (
    <PostForm
      isEditing
      seoProUnlocked={isSeoProUnlocked({ id: active.tenantId, plan })}
      initialData={{
        id: post.id,
        title: post.title,
        // US-021 — what the article is published at today. Its presence is what
        // makes the URL field appear, and what the rename warning compares to.
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt || "",
        coverImage: post.coverImage || "",
        // US-009 — `posts.seo.imageAlt`, read through the fail-closed parser
        // because the column is untyped Json.
        coverImageAlt: readEntitySeo(post.seo).imageAlt || "",
        published: post.published,
      }}
    />
  );
}
