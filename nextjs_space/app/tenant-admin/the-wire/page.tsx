import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUserPermissions } from "@/lib/permissions/current-user-permissions";
import { can } from "@/lib/permissions/resolve";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import PostsList from "./posts-list";

export const metadata = {
  title: "The Wire Management",
};

export default async function TheWirePage() {
  // PRD-302: impersonation-aware tenant (matches the banner).
  const active = await getActiveAdminTenant();
  if (!active) {
    redirect("/auth/login");
  }

  const posts = await prisma.posts.findMany({
    where: { tenantId: active.tenantId },
    orderBy: { createdAt: "desc" },
    include: { users: true },
  });

  // US-022 — the newsletter action writes a campaign, so it is gated on the
  // permission the endpoint enforces (US-009), not on the blog's own. Fail-closed
  // by construction: `getCurrentUserPermissions` returns ALL_FALSE for anyone it
  // cannot resolve, so an unknown subject is offered nothing.
  const { permissions } = await getCurrentUserPermissions();

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

      <PostsList
        initialPosts={posts}
        canSendAsNewsletter={can(permissions, "canEditEmails")}
      />
    </div>
  );
}
