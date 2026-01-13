import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import PostForm from "../post-form";

export const metadata = {
  title: "Edit Article | The Wire",
};

export default async function EditPostPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const { id } = params;

  const post = await prisma.posts.findUnique({
    where: { id },
  });

  if (!post) {
    notFound();
  }

  // Verify tenant access
  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { tenants: true },
  });

  if (post.tenantId !== user?.tenantId) {
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
