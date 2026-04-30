import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import PostsList from "./posts-list";

export const metadata = {
  title: "The Wire Management",
};

export default async function TheWirePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    include: { tenants: true },
  });

  if (!localUser?.tenants) {
    redirect("/tenant-admin");
  }

  const posts = await prisma.posts.findMany({
    where: { tenantId: localUser.tenants.id },
    orderBy: { createdAt: "desc" },
    include: { users: true },
  });

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="bs-page-title"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            The Wire
          </h1>
          <p className="bs-page-subtitle">
            Manage your news and articles.
          </p>
        </div>
        <div className="flex justify-start sm:justify-end">
          <Link
            href="/tenant-admin/the-wire/new"
            className="bs-btn bs-btn-green"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Article
          </Link>
        </div>
      </div>

      <PostsList initialPosts={posts} />
    </div>
  );
}
