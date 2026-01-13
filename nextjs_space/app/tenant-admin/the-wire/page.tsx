import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import PostsList from "./posts-list";
import { Breadcrumbs } from "@/components/admin/shared";

export const metadata = {
  title: "The Wire Management",
};

export default async function TheWirePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    include: { tenants: true },
  });

  if (!user?.tenants) {
    redirect("/tenant-admin");
  }

  const posts = await prisma.posts.findMany({
    where: { tenantId: user.tenants.id },
    orderBy: { createdAt: "desc" },
    include: { users: true },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/tenant-admin" },
          { label: "The Wire" },
        ]}
        className="mb-4"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            The Wire
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
            Manage your news and articles
          </p>
        </div>
        <Link href="/tenant-admin/the-wire/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
            <Plus className="mr-2 h-4 w-4" /> New Article
          </Button>
        </Link>
      </div>

      <PostsList initialPosts={posts} />
    </div>
  );
}
