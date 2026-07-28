"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Lock,
  PencilLine,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface Doc {
  slug: string;
  title: string;
  summary: string;
  defaultVersion: string;
  mode: string;
  body: string;
  publishedAt: string | null;
  liveStatus: "published" | "unpublished";
  responsibilityAcceptedAt: string | null;
}

interface Props {
  documents: Doc[];
  storefrontBase: string;
}

export default function DocumentManager({ documents, storefrontBase }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(documents.map((d) => [d.slug, d.body])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const save = useCallback(
    async (
      doc: Doc,
      mode: "default" | "custom",
      publish: boolean,
      acceptResponsibility = false,
    ) => {
      setBusy(doc.slug);
      try {
        const res = await fetch(`/api/tenant-admin/legal/documents/${doc.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            body: mode === "custom" ? drafts[doc.slug] : undefined,
            publish,
            acceptResponsibility,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not save.");

        toast.success(
          publish
            ? `${doc.title} published to your site.`
            : `${doc.title} saved. Publish it to make it live.`,
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

  const switchToCustom = useCallback(
    (doc: Doc) => {
      const ok = window.confirm(
        `Use your own wording for ${doc.title}?\n\n` +
          `It becomes your document. You are responsible for its content and ` +
          `for keeping it up to date — we will not update it for you, and ` +
          `changes we make to the standard wording will no longer reach it.`,
      );
      if (!ok) return;
      setDrafts((d) => ({ ...d, [doc.slug]: d[doc.slug] || "" }));
      setOpen(doc.slug);
      void save(doc, "custom", false, true);
    },
    [save],
  );

  const showPreview = useCallback(
    async (doc: Doc) => {
      setBusy(doc.slug);
      try {
        const res = await fetch(`/api/tenant-admin/legal/documents/${doc.slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: drafts[doc.slug] }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not build a preview.");
        setPreview(json.html);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong.");
      } finally {
        setBusy(null);
      }
    },
    [drafts],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-bs-fg">Your legal pages</h1>
        <p className="mt-2 max-w-2xl text-sm text-bs-fg-2">
          Four documents are published on your site. Use our standard wording,
          which we keep up to date, or write your own. You can decide separately
          for each one.
        </p>
      </header>

      <div className="space-y-4">
        {documents.map((doc) => {
          const isCustom = doc.mode === "custom";
          const isLive = doc.liveStatus === "published";

          return (
            <section key={doc.slug} className="rounded-xl border border-bs-border">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-bs-fg-2" />
                    <h2 className="font-medium text-bs-fg">{doc.title}</h2>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" /> Not live
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-bs-fg-2">{doc.summary}</p>
                  <p className="mt-1.5 text-xs text-bs-fg-3">
                    {isCustom
                      ? "Your own wording — you maintain it."
                      : `Standard wording, version ${doc.defaultVersion} — we keep it current.`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isLive && (
                    <a
                      href={`${storefrontBase}/${doc.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg-2 hover:border-bs-green"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {isCustom ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpen(open === doc.slug ? null : doc.slug)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg hover:border-bs-green"
                      >
                        <PencilLine className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => save(doc, "default", true)}
                        disabled={busy === doc.slug}
                        className="rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg-2 hover:border-bs-green disabled:opacity-50"
                      >
                        Use standard wording
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => save(doc, "default", true)}
                        disabled={busy === doc.slug}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-bs-green px-3 py-1.5 text-xs font-medium text-bs-bg disabled:opacity-50"
                      >
                        {busy === doc.slug && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {isLive ? "Republish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => switchToCustom(doc)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg-2 hover:border-amber-400"
                      >
                        <PencilLine className="h-3.5 w-3.5" /> Write my own
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isCustom && !isLive && (
                <div className="border-t border-bs-border px-5 py-3 text-xs text-amber-300">
                  Nothing is published for this page yet. Visitors are told it is
                  unavailable and pointed to you.
                </div>
              )}

              {open === doc.slug && (
                <div className="border-t border-bs-border p-5">
                  <div className="mb-2 flex items-center gap-2 text-xs text-bs-fg-2">
                    <Lock className="h-3.5 w-3.5" />
                    Markdown. Use <code>##</code> for headings, <code>**bold**</code>,
                    and <code>-</code> for lists.
                  </div>
                  <textarea
                    rows={18}
                    value={drafts[doc.slug] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [doc.slug]: e.target.value }))
                    }
                    placeholder={`## ${doc.title}\n\nYour wording…`}
                    className="w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 font-mono text-xs text-bs-fg outline-none focus:border-bs-green"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => save(doc, "custom", true)}
                      disabled={busy === doc.slug}
                      className="inline-flex items-center gap-2 rounded-lg bg-bs-green px-4 py-2 text-sm font-medium text-bs-bg disabled:opacity-50"
                    >
                      {busy === doc.slug && <Loader2 className="h-4 w-4 animate-spin" />}
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={() => save(doc, "custom", false)}
                      disabled={busy === doc.slug}
                      className="rounded-lg border border-bs-border px-4 py-2 text-sm text-bs-fg disabled:opacity-50"
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      onClick={() => showPreview(doc)}
                      disabled={busy === doc.slug}
                      className="inline-flex items-center gap-2 rounded-lg border border-bs-border px-4 py-2 text-sm text-bs-fg-2 disabled:opacity-50"
                    >
                      <Eye className="h-4 w-4" /> Preview
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-bs-border bg-bs-bg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium text-bs-fg">Preview</h2>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg-2"
              >
                Close
              </button>
            </div>
            <div
              className="legal-document text-sm"
              // Safe: rendered server-side by the same escape-first markdown
              // pipeline the storefront uses. See lib/legal/markdown.ts.
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
