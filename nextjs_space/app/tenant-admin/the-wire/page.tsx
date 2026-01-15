import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Newspaper } from "lucide-react";
import PostsList from "./posts-list";

export const metadata = {
  title: "The Wire Management",
};

export default async function TheWirePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
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
      {/* Centered Header with Absolute Right Button */}
      <div className="relative mb-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="section-badge mb-4 inline-flex">
            <Newspaper className="h-4 w-4" />
            Content
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            The Wire
          </h1>
          <p className="mt-3 text-muted-foreground">
            Manage your news and articles.
          </p>
        </div>
        <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <Link href="/tenant-admin/the-wire/new">
            <Button variant="hero" size="lg" className="rounded-xl shadow-lg hover:shadow-xl transition-all">
              <Plus className="mr-2 h-4 w-4" />
              New Article
            </Button>
          </Link>
        </div>
      </div>

      <PostsList initialPosts={posts} />
    </div>
  );
}
