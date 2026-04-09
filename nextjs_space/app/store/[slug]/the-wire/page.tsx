import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Newspaper } from "lucide-react";
import { posts } from "@prisma/client";
import { getTenantBasePath } from "@/lib/tenant-utils";
import { getCurrentTenant } from "@/lib/tenant";

export const revalidate = 60;

interface TheWirePageProps {
  params: {
    slug: string;
  };
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  news: { bg: "hsl(210 100% 95%)", text: "hsl(210 100% 35%)" },
  research: { bg: "hsl(152 60% 92%)", text: "hsl(152 60% 28%)" },
  updates: { bg: "hsl(38 92% 92%)", text: "hsl(38 92% 35%)" },
  guide: { bg: "hsl(172 66% 92%)", text: "hsl(172 66% 28%)" },
  stories: { bg: "hsl(350 80% 93%)", text: "hsl(350 80% 35%)" },
};

function getCategoryStyle(category?: string | null) {
  if (!category) return categoryColors.news;
  const key = category.toLowerCase();
  return categoryColors[key] || categoryColors.news;
}

export default async function TheWirePage({ params }: TheWirePageProps) {
  const { slug } = params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const basePath = getTenantBasePath(tenant.subdomain);

  const postsList = await prisma.posts.findMany({
    where: {
      tenantId: tenant.id,
      published: true,
    },
    orderBy: { createdAt: "desc" },
    include: { users: true },
  });

  const featuredPost = postsList[0] || null;
  const remainingPosts = postsList.slice(1);

  return (
    <div
      className="min-h-screen pb-24 lg:pb-0"
      style={{ backgroundColor: "hsl(var(--tenant-color-background))" }}
    >
      <main>
        {/* Hero Section */}
        <section
          className="pt-28 md:pt-32 pb-16 md:pb-24 relative overflow-hidden"
          style={{ backgroundColor: "hsl(var(--tenant-color-primary))" }}
        >
          {/* SVG dot pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%">
              <pattern
                id="dots"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1.5" fill="white" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-4xl mx-auto text-center">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight text-white"
                style={{
                  fontFamily: "var(--tenant-font-heading, sans-serif)",
                }}
              >
                The Wire
              </h1>
              <p
                className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto"
                style={{
                  fontFamily: "var(--tenant-font-base, sans-serif)",
                }}
              >
                Latest news, research updates, and insights from{" "}
                {tenant.businessName}.
              </p>
            </div>
          </div>
        </section>

        {postsList.length === 0 ? (
          /* Empty State */
          <section className="py-24 md:py-32">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-md mx-auto text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{
                    backgroundColor:
                      "hsl(var(--tenant-color-primary) / 0.1)",
                  }}
                >
                  <Newspaper
                    className="w-10 h-10"
                    style={{ color: "hsl(var(--tenant-color-primary))" }}
                  />
                </div>
                <h2
                  className="text-2xl font-semibold mb-3"
                  style={{
                    color: "hsl(var(--tenant-color-heading))",
                    fontFamily: "var(--tenant-font-heading, sans-serif)",
                  }}
                >
                  No articles yet
                </h2>
                <p
                  className="text-base"
                  style={{
                    color: "hsl(var(--tenant-color-text))",
                    fontFamily: "var(--tenant-font-base, sans-serif)",
                  }}
                >
                  Check back soon for the latest news and updates.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Featured Article */}
            {featuredPost && (
              <section className="py-16 md:py-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <Link href={`${basePath}/the-wire/${featuredPost.slug}`}>
                    <div
                      className="grid md:grid-cols-2 gap-8 rounded-2xl overflow-hidden border hover:shadow-xl transition-shadow duration-300"
                      style={{
                        borderColor:
                          "hsl(var(--tenant-color-primary) / 0.12)",
                      }}
                    >
                      {/* Image */}
                      <div
                        className="aspect-video md:aspect-auto md:min-h-[360px] relative overflow-hidden"
                        style={{
                          backgroundColor:
                            "hsl(var(--tenant-color-primary) / 0.05)",
                        }}
                      >
                        {featuredPost.coverImage ? (
                          <img
                            src={featuredPost.coverImage}
                            alt={featuredPost.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Newspaper
                              className="w-16 h-16 opacity-20"
                              style={{
                                color: "hsl(var(--tenant-color-primary))",
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-8 md:p-10 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-4">
                          <Badge
                            variant="secondary"
                            className="text-xs font-medium px-3 py-1"
                            style={{
                              backgroundColor:
                                getCategoryStyle(
                                  (featuredPost as any).category
                                ).bg,
                              color:
                                getCategoryStyle(
                                  (featuredPost as any).category
                                ).text,
                            }}
                          >
                            {(featuredPost as any).category || "News"}
                          </Badge>
                          <span
                            className="text-sm"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily:
                                "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            Featured
                          </span>
                        </div>

                        <h2
                          className="text-2xl md:text-3xl font-bold mb-4 tracking-tight"
                          style={{
                            color: "hsl(var(--tenant-color-heading))",
                            fontFamily:
                              "var(--tenant-font-heading, sans-serif)",
                          }}
                        >
                          {featuredPost.title}
                        </h2>

                        {featuredPost.excerpt && (
                          <p
                            className="text-base leading-relaxed mb-6 line-clamp-3"
                            style={{
                              color: "hsl(var(--tenant-color-text))",
                              fontFamily:
                                "var(--tenant-font-base, sans-serif)",
                            }}
                          >
                            {featuredPost.excerpt}
                          </p>
                        )}

                        <div
                          className="flex items-center gap-3 text-sm"
                          style={{
                            color: "hsl(var(--tenant-color-text))",
                            fontFamily: "var(--tenant-font-base, sans-serif)",
                          }}
                        >
                          <span>
                            {(
                              featuredPost as posts & {
                                users: { name: string | null } | null;
                              }
                            ).users?.name || "Admin"}
                          </span>
                          <span className="opacity-40">·</span>
                          <span>
                            {format(
                              new Date(featuredPost.createdAt),
                              "MMM d, yyyy"
                            )}
                          </span>
                        </div>

                        <div className="mt-6">
                          <span
                            className="inline-flex items-center gap-2 font-medium text-sm"
                            style={{
                              color: "hsl(var(--tenant-color-primary))",
                            }}
                          >
                            Read Article{" "}
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </section>
            )}

            {/* Latest Articles Grid */}
            {remainingPosts.length > 0 && (
              <section className="py-8 md:py-16">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <h2
                    className="text-2xl md:text-3xl font-semibold mb-10 tracking-tight"
                    style={{
                      color: "hsl(var(--tenant-color-heading))",
                      fontFamily: "var(--tenant-font-heading, sans-serif)",
                    }}
                  >
                    Latest Articles
                  </h2>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {remainingPosts.map(
                      (
                        post: posts & {
                          users: { name: string | null } | null;
                        }
                      ) => (
                        <Link
                          key={post.id}
                          href={`${basePath}/the-wire/${post.slug}`}
                        >
                          <article
                            className="group rounded-xl overflow-hidden border hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col"
                            style={{
                              borderColor:
                                "hsl(var(--tenant-color-primary) / 0.1)",
                              backgroundColor:
                                "hsl(var(--tenant-color-background))",
                            }}
                          >
                            {/* Cover Image */}
                            <div
                              className="aspect-video overflow-hidden relative"
                              style={{
                                backgroundColor:
                                  "hsl(var(--tenant-color-primary) / 0.05)",
                              }}
                            >
                              {post.coverImage ? (
                                <img
                                  src={post.coverImage}
                                  alt={post.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Newspaper
                                    className="w-10 h-10 opacity-20"
                                    style={{
                                      color:
                                        "hsl(var(--tenant-color-primary))",
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="p-6 flex-1 flex flex-col">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge
                                  variant="secondary"
                                  className="text-xs font-medium px-2 py-0.5"
                                  style={{
                                    backgroundColor:
                                      getCategoryStyle(
                                        (post as any).category
                                      ).bg,
                                    color:
                                      getCategoryStyle(
                                        (post as any).category
                                      ).text,
                                  }}
                                >
                                  {(post as any).category || "News"}
                                </Badge>
                              </div>

                              <h3
                                className="text-lg font-semibold mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity"
                                style={{
                                  color: "hsl(var(--tenant-color-heading))",
                                  fontFamily:
                                    "var(--tenant-font-heading, sans-serif)",
                                }}
                              >
                                {post.title}
                              </h3>

                              {post.excerpt && (
                                <p
                                  className="text-sm leading-relaxed mb-4 line-clamp-2 flex-1"
                                  style={{
                                    color: "hsl(var(--tenant-color-text))",
                                    fontFamily:
                                      "var(--tenant-font-base, sans-serif)",
                                  }}
                                >
                                  {post.excerpt}
                                </p>
                              )}

                              <div
                                className="flex items-center gap-2 text-xs mt-auto pt-4"
                                style={{
                                  color: "hsl(var(--tenant-color-text))",
                                  fontFamily:
                                    "var(--tenant-font-base, sans-serif)",
                                  opacity: 0.7,
                                }}
                              >
                                <span>{post.users?.name || "Admin"}</span>
                                <span>·</span>
                                <span>
                                  {format(
                                    new Date(post.createdAt),
                                    "MMM d, yyyy"
                                  )}
                                </span>
                              </div>
                            </div>
                          </article>
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
