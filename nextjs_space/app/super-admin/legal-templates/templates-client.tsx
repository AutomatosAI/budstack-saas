"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Loader2, Users } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface Template {
  slug: string;
  title: string;
  summary: string;
  requiredTokens: string[];
  body: string;
  version: string;
  shippedVersion: string;
  edited: boolean;
  storefrontsInheriting: number;
  updatedAt: string | null;
}

export default function TemplateEditor({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { body: string; version: string }>>(
    () =>
      Object.fromEntries(
        templates.map((t) => [t.slug, { body: t.body, version: t.version }]),
      ),
  );
  const [busy, setBusy] = useState<string | null>(null);

  const save = useCallback(
    async (tpl: Template) => {
      const draft = drafts[tpl.slug];

      if (draft.version === tpl.version) {
        toast.error("Bump the version — operators inherit this immediately.");
        return;
      }

      const ok = window.confirm(
        `Publish new wording for ${tpl.title}?\n\n` +
          `${tpl.storefrontsInheriting} live storefront(s) inherit this and will ` +
          `serve the new text immediately. Operators using their own wording are ` +
          `not affected.`,
      );
      if (!ok) return;

      setBusy(tpl.slug);
      try {
        const res = await fetch(`/api/super-admin/legal-templates/${tpl.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not save.");

        toast.success(
          `${tpl.title} updated — ${json.storefrontsAffected} storefront(s) now serving it.`,
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setBusy(null);
      }
    },
    [drafts, router],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-bs-fg">Standard legal wording</h1>
        <p className="mt-2 max-w-2xl text-sm text-bs-fg-2">
          The documents every operator inherits unless they write their own.
          Editing here changes what live storefronts serve, immediately.
        </p>
      </header>

      <div className="space-y-4">
        {templates.map((tpl) => (
          <section key={tpl.slug} className="rounded-xl border border-bs-border">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-bs-fg-2" />
                  <h2 className="font-medium text-bs-fg">{tpl.title}</h2>
                  <span className="font-bs-mono text-xs text-bs-fg-3">
                    v{tpl.version}
                  </span>
                  {!tpl.edited && (
                    <span className="text-xs text-bs-fg-3">as shipped</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-bs-fg-2">{tpl.summary}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-bs-fg-3">
                  <Users className="h-3.5 w-3.5" />
                  {tpl.storefrontsInheriting} live storefront
                  {tpl.storefrontsInheriting === 1 ? "" : "s"} inherit this
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(open === tpl.slug ? null : tpl.slug)}
                className="rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg hover:border-bs-green"
              >
                {open === tpl.slug ? "Close" : "Edit"}
              </button>
            </div>

            {open === tpl.slug && (
              <div className="border-t border-bs-border p-5">
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-xs text-bs-fg-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    These placeholders must stay in the text or every operator
                    inheriting it stops publishing:{" "}
                    <span className="font-bs-mono text-bs-fg">
                      {tpl.requiredTokens.map((t) => `{{${t}}}`).join(" ")}
                    </span>
                  </div>
                </div>

                <textarea
                  rows={24}
                  value={drafts[tpl.slug].body}
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [tpl.slug]: { ...d[tpl.slug], body: e.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 font-mono text-xs text-bs-fg outline-none focus:border-bs-green"
                />

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-bs-fg-2">Version</label>
                    <input
                      type="text"
                      value={drafts[tpl.slug].version}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [tpl.slug]: { ...d[tpl.slug], version: e.target.value },
                        }))
                      }
                      className="mt-1 w-32 rounded-lg border border-bs-border bg-transparent px-3 py-2 font-bs-mono text-xs text-bs-fg outline-none focus:border-bs-green"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => save(tpl)}
                    disabled={busy === tpl.slug}
                    className="inline-flex items-center gap-2 rounded-lg bg-bs-green px-4 py-2 text-sm font-medium text-bs-bg disabled:opacity-50"
                  >
                    {busy === tpl.slug && <Loader2 className="h-4 w-4 animate-spin" />}
                    Publish to {tpl.storefrontsInheriting} storefront
                    {tpl.storefrontsInheriting === 1 ? "" : "s"}
                  </button>
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
