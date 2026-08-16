"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle, EyeOff, ImageOff, Search } from "lucide-react";

import { SeoEditorModal } from "@/components/admin/seo";
import type { PlatformSeoRoute } from "@/lib/platform/seo-routes";
import type { PlatformSeoSettingRow } from "@/lib/platform/seo-settings";
import type { EntitySeo } from "@/lib/seo/entity-seo";

/**
 * The platform SEO list (US-014) — one row per public marketing route, each
 * opening the SAME `SeoEditorModal` the tenant SEO Manager uses. Nothing about
 * the editor is reimplemented here; what differs is declared as props:
 *
 *  - `indexingFields={["noindex"]}` — `platform_seo_settings` has that column
 *    and no others, so the other three controls are not offered rather than
 *    offered and discarded.
 *  - `ogUploadEndpoint` — `/api/platform/upload` (super-admin, platform S3
 *    prefix). The tenant upload route reads a `tenantId` a super-admin has not
 *    got.
 *  - `canUseAiAssist` / `canEditQa` are off: both are tenant-plan features
 *    backed by tenant routes, and there is no plan to upgrade here.
 *
 * VALUES ARE NEVER IMPORTED FROM `lib/platform/seo-routes`, only its type: that
 * module reads the guide registry, and a value import would pull eighteen guide
 * modules' prose into this bundle. The route list arrives as a prop.
 */

/** The one indexing control `platform_seo_settings` has a column for. */
const PLATFORM_INDEXING_FIELDS = ["noindex"] as const;

/** US-005's super-admin upload route — see the module note. */
const PLATFORM_UPLOAD_ENDPOINT = "/api/platform/upload";

const GROUP_BLURB: Readonly<Record<string, string>> = {
  Marketing:
    "The pages a prospect lands on. These are the titles and descriptions worth writing by hand.",
  Documentation:
    "The BudStacks Guide — the largest content set on the site, and the one most likely to be found by search.",
  Legal:
    "Compliance pages. They rarely need custom copy, but they do need a social card that is not blank.",
};

/** The stored fields for one route, keyed by path. */
type SettingsByPath = Readonly<Record<string, PlatformSeoSettingRow>>;

function indexByPath(rows: readonly PlatformSeoSettingRow[]): SettingsByPath {
  return Object.fromEntries(rows.map((row) => [row.routePath, row]));
}

/** The public URL of a route. "/" is the origin itself, with no trailing slash. */
function routeUrl(baseUrl: string, path: string): string {
  return path === "/" ? baseUrl : `${baseUrl}${path}`;
}

/**
 * The stored row as the editor's record.
 *
 * Only `noindex: true` becomes a `robots` key — `readEntitySeo` treats an absent
 * key and "everything allowed" as the same state, and writing `false` would make
 * the editor open with a rule it does not have.
 */
function toEditorSeo(row: PlatformSeoSettingRow | undefined): EntitySeo {
  return {
    ...(row?.title ? { title: row.title } : {}),
    ...(row?.description ? { description: row.description } : {}),
    ...(row?.ogImage ? { ogImage: row.ogImage } : {}),
    ...(row?.noindex ? { robots: { noindex: true } } : {}),
  };
}

/** The groups in the order the server listed them — never a restated list. */
function orderedGroups(routes: readonly PlatformSeoRoute[]): string[] {
  return routes.reduce<string[]>(
    (groups, route) =>
      groups.includes(route.group) ? groups : [...groups, route.group],
    [],
  );
}

interface PlatformSeoClientProps {
  /** The platform origin, resolved server-side by `platformBaseUrl()`. */
  baseUrl: string;
  routes: readonly PlatformSeoRoute[];
  settings: readonly PlatformSeoSettingRow[];
}

export default function PlatformSeoClient({
  baseUrl,
  routes,
  settings,
}: PlatformSeoClientProps) {
  const [stored, setStored] = useState<SettingsByPath>(() =>
    indexByPath(settings),
  );
  const [selected, setSelected] = useState<PlatformSeoRoute | null>(null);

  const groups = useMemo(() => orderedGroups(routes), [routes]);

  // Stable across the modal's own re-renders, so typing in it cannot be undone
  // by the effect that syncs `initialSeo`.
  const selectedSeo = useMemo(
    () => (selected ? toEditorSeo(stored[selected.path]) : undefined),
    [selected, stored],
  );

  const handleSave = async (seo: EntitySeo) => {
    if (!selected) return;

    const res = await fetch("/api/platform/seo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Every field, every time: the route replaces the whole record, so an
      // emptied box has to arrive as "" for the column to be cleared.
      body: JSON.stringify({
        routePath: selected.path,
        title: seo.title ?? "",
        description: seo.description ?? "",
        ogImage: seo.ogImage ?? "",
        noindex: seo.robots?.noindex === true,
      }),
    });

    // Thrown, not toasted: the modal catches it, reports the failure and keeps
    // the dialog open with the typed values intact.
    if (!res.ok) throw new Error("Failed to save");

    const body: { setting?: PlatformSeoSettingRow } | null = await res
      .json()
      .catch(() => null);
    const saved = body?.setting;
    if (!saved) return;

    // Set from what the server says it stored, never from what was submitted:
    // "" is normalised to NULL on the way in, and the list must show the same
    // state the next reader will see.
    setStored((prev) => ({ ...prev, [saved.routePath]: saved }));
  };

  return (
    <>
      {groups.map((group) => (
        <section key={group} className="bs-card bs-card-pad space-y-4">
          <div>
            <h2
              className="text-[22px] leading-tight"
              style={{
                fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
              }}
            >
              {group}
            </h2>
            <p className="text-sm text-bs-fg-muted">
              {GROUP_BLURB[group] ?? ""}
            </p>
          </div>

          <div className="divide-y divide-bs-border-100">
            {routes
              .filter((route) => route.group === group)
              .map((route) => (
                <RouteRow
                  key={route.path}
                  route={route}
                  url={routeUrl(baseUrl, route.path)}
                  row={stored[route.path]}
                  onEdit={() => setSelected(route)}
                />
              ))}
          </div>
        </section>
      ))}

      {selected && (
        <SeoEditorModal
          isOpen={!!selected}
          onClose={() => setSelected(null)}
          entityType="page"
          entityId={selected.path}
          entityName={selected.name}
          entitySlug={selected.path}
          previewUrl={routeUrl(baseUrl, selected.path)}
          initialSeo={selectedSeo}
          onSave={handleSave}
          canUploadOgImage
          canEditIndexing
          indexingFields={PLATFORM_INDEXING_FIELDS}
          ogUploadEndpoint={PLATFORM_UPLOAD_ENDPOINT}
        />
      )}
    </>
  );
}

interface RouteRowProps {
  route: PlatformSeoRoute;
  url: string;
  row: PlatformSeoSettingRow | undefined;
  onEdit: () => void;
}

/**
 * One route.
 *
 * The badge tracks TITLE AND DESCRIPTION only — the two fields that change what
 * a searcher reads. `ogImage` is deliberately excluded from it: the US-013 seed
 * gave every static route the platform default, so a badge that counted it
 * would read "Custom" for all fifteen on day one and mean nothing. The image is
 * called out the other way round, as a warning when it is MISSING, which is the
 * state the unseeded guide routes are in.
 */
function RouteRow({ route, url, row, onEdit }: RouteRowProps) {
  const hasAuthoredCopy = !!(row?.title || row?.description);

  return (
    <div className="flex flex-col justify-between gap-4 py-3 sm:flex-row sm:items-center">
      <div className="w-full min-w-0 sm:w-auto">
        <p className="font-medium text-bs-fg">{route.name}</p>
        <p className="truncate font-mono text-xs text-bs-fg-muted">{url}</p>
      </div>

      <div className="flex w-full flex-shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
        {row?.noindex && (
          <span className="bs-chip bs-chip-warn inline-flex items-center gap-1">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            No-index
          </span>
        )}
        {!row?.ogImage && (
          <span className="bs-chip bs-chip-muted inline-flex items-center gap-1">
            <ImageOff className="h-3 w-3" aria-hidden="true" />
            No social image
          </span>
        )}
        <span
          className={
            hasAuthoredCopy
              ? "bs-chip bs-chip-green inline-flex items-center gap-1"
              : "bs-chip bs-chip-muted inline-flex items-center gap-1"
          }
        >
          {hasAuthoredCopy ? (
            <>
              <CheckCircle className="h-3 w-3" aria-hidden="true" />
              Custom
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              Default
            </>
          )}
        </span>
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm"
          onClick={onEdit}
        >
          <Search className="mr-1 h-4 w-4" aria-hidden="true" />
          Edit SEO
        </button>
      </div>
    </div>
  );
}
