import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
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

  const post = await prisma.posts.findUnique({
    where: { id },
  });

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
      initialData={{
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || "",
        coverImage: post.coverImage || "",
        published: post.published,
      }}
    />
  );
}
