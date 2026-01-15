import { currentUser } from "@clerk/nextjs/server";
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
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { id } = params;

  const post = await prisma.posts.findUnique({
    where: { id },
  });

  if (!post) {
    notFound();
  }

  // Verify tenant access
  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: { tenants: true },
  });

  if (post.tenantId !== localUser?.tenantId) {
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
