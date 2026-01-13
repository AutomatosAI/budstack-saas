import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { posts } from "@prisma/client";

export const revalidate = 60; // Revalidate every minute

interface TheWirePageProps {
  params: {
    slug: string; // Tenant subdomain
  };
}

export default async function TheWirePage({ params }: TheWirePageProps) {
  const { slug } = params;

  // 1. Fetch Tenant
  const tenant = await prisma.tenants.findUnique({
    where: { subdomain: slug },
  });

  if (!tenant) notFound();

  // 2. Fetch Posts
  const posts = await prisma.posts.findMany({
    where: {
      tenantId: tenant.id,
      published: true,
    },
    orderBy: { createdAt: "desc" },
    include: { users: true },
  });

  return (
    <div className="min-h-screen bg-background text-foreground pt-36 pb-12">
      <div className="container px-4 mx-auto max-w-7xl">
        <div className="flex flex-col items-center mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
            The Wire
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Latest news, updates, and insights from {tenant.businessName}.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post: posts & { users: { name: string | null } | null }) => (
            <Card key={post.id} className="flex flex-col overflow-hidden h-full hover:shadow-lg transition-shadow">
              {post.coverImage && (
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                </div>
              )}
              <CardContent className="flex-1 p-6 flex flex-col">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <span>
                    {format(new Date(post.createdAt), 'MMM d, yyyy')}
                  </span>
                  <span>•</span>
                  <span>{post.users?.name || 'Admin'}</span>
                </div>

                <h2 className="text-xl font-bold mb-2 line-clamp-2">
                  <Link href={`/store/${slug}/the-wire/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>

                {post.excerpt && (
                  <p className="text-muted-foreground mb-4 line-clamp-3 flex-1">
                    {post.excerpt}
                  </p>
                )}
                <CardContent className="flex-1 p-6 flex flex-col">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <span>
                      {format(new Date(post.createdAt), "MMM d, yyyy")}
                    </span>
                    <span>•</span>
                    <span>{post.author?.name || "Admin"}</span>
                  </div>

                  <h2 className="text-xl font-bold mb-2 line-clamp-2">
                    <Link
                      href={`/store/${slug}/the-wire/${post.slug}`}
                      className="hover:underline"
                    >
                      {post.title}
                    </Link>
                  </h2>

                  {post.excerpt && (
                    <p className="text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    <Button asChild variant="link" className="px-0">
                      <Link href={`/store/${slug}/the-wire/${post.slug}`}>
                        Read Article <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ),
          )}
          {posts.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                No articles published yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
