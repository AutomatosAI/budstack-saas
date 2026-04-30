import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Newspaper } from "lucide-react";
import PostsList from "./posts-list";
import { AdminPageHeader } from "@/components/admin/shared";

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
      <AdminPageHeader
        eyebrow="Content"
        eyebrowIcon={Newspaper}
        title="The Wire"
        subtitle="Manage your news and articles."
        actions={
          <Link href="/tenant-admin/the-wire/new">
            <Button variant="hero" size="lg" className="rounded-xl shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-4 w-4" />
              New Article
            </Button>
          </Link>
        }
      />

      <PostsList initialPosts={posts} />
    </div>
  );
}
