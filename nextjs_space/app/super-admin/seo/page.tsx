import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  PLATFORM_SEO_SETTING_SELECT,
  type PlatformSeoSettingRow,
} from "@/lib/platform/seo-settings";
import { platformSeoRoutes } from "@/lib/platform/seo-routes";
import { platformBaseUrl } from "@/lib/seo/platform-url";
import PlatformSeoClient from "./platform-seo-client";

/**
 * Platform SEO — the title, description and social card budstacks.io serves for
 * its own marketing routes (US-014).
 *
 * This is NOT the tenant SEO Manager (`app/tenant-admin/seo`). It edits
 * `platform_seo_settings`, which has no tenant, so no query here names a
 * tenantId — the model is deliberately absent from `tenantScopedModels`
 * (lib/db.ts), an OPT-IN allowlist, and joining it would weld a tenant filter
 * onto this read and return nothing.
 *
 * THE ROUTE LIST IS RESOLVED HERE, on the server: `platformSeoRoutes()` reads
 * the guide registry, which is eighteen modules of prose that must not reach a
 * browser bundle. The client gets plain data.
 */

/**
 * The build-time Prisma client is a mock that answers every query with `[]`
 * (DATABASE_URL is a dummy at build). Without this, an empty settings list
 * would be baked into the static output and every route would read "Default"
 * however many are actually authored.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform SEO — Platform",
};

export default async function PlatformSeoPage() {
  // The layout gates this segment already; repeated here as the neighbouring
  // super-admin pages do (leads, the-wire, subprocessors), so the page cannot
  // render its content if it is ever mounted outside that layout.
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Row type stated explicitly: the `prisma` export is any-widened, so an
  // inferred result makes every map callback downstream an implicit `any`
  // (TS7006).
  const settings: PlatformSeoSettingRow[] =
    await prisma.platform_seo_settings.findMany({
      select: PLATFORM_SEO_SETTING_SELECT,
    });

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact">
        <h1
          className="bs-page-title"
          style={{
            fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
          }}
        >
          Platform SEO
        </h1>
        <p className="bs-page-subtitle">
          What a search engine reads for budstacks.io itself. Every field is an
          override — leave one empty and the page keeps the metadata it ships
          with.
        </p>
      </div>

      <PlatformSeoClient
        baseUrl={platformBaseUrl()}
        routes={platformSeoRoutes()}
        settings={settings}
      />
    </div>
  );
}
