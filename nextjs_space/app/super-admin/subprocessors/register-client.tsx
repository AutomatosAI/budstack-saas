"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Megaphone,
  Plus,
  Archive,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface Entry {
  id: string;
  name: string;
  purpose: string;
  region: string;
  transferMechanism: string;
  dpaUrl: string | null;
  status: string;
  effectiveFrom: string;
  announcedAt: string | null;
  notes: string | null;
  _count?: { objections: number };
}

interface Objection {
  id: string;
  reason: string;
  outOfWindow: boolean;
  createdAt: string;
  subprocessor: { name: string };
  tenants: { businessName: string };
}

interface Props {
  entries: Entry[];
  objections: Objection[];
  minNoticeDays: number;
  todayIso: string;
}

const BLANK = {
  id: "",
  name: "",
  purpose: "",
  region: "",
  transferMechanism: "",
  dpaUrl: "",
  notes: "",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SubprocessorRegister({
  entries,
  objections,
  minNoticeDays,
  todayIso,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(BLANK);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // The earliest date that still gives operators the notice the DPA promises.
  const earliest = useMemo(() => {
    const d = new Date(todayIso);
    d.setDate(d.getDate() + minNoticeDays);
    return d.toISOString().slice(0, 10);
  }, [todayIso, minNoticeDays]);

  const call = useCallback(
    async (url: string, method: string, body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Something went wrong.");
      return json;
    },
    [],
  );

  const onCreate = useCallback(async () => {
    setBusy("create");
    try {
      await call("/api/super-admin/subprocessors", "POST", {
        ...draft,
        effectiveFrom: effectiveFrom || earliest,
      });
      toast.success("Draft saved. Nobody has been told yet — announce when ready.");
      setDraft(BLANK);
      setEffectiveFrom("");
      setShowForm(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }, [call, draft, effectiveFrom, earliest, router]);

  const onAnnounce = useCallback(
    async (entry: Entry) => {
      const ok = window.confirm(
        `Email every active operator about ${entry.name}?\n\n` +
          `This starts the objection window and cannot be undone.`,
      );
      if (!ok) return;

      setBusy(entry.id);
      try {
        const result = await call(
          `/api/super-admin/subprocessors/${entry.id}`,
          "POST",
        );
        toast.success(
          `Announced to ${result.announced} operator(s)` +
            (result.failed ? `, ${result.failed} failed — check the logs.` : "."),
        );
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not announce.");
      } finally {
        setBusy(null);
      }
    },
    [call, router],
  );

  const onRetire = useCallback(
    async (entry: Entry) => {
      const reason = window.prompt(
        `Retire ${entry.name}? Give a reason — it is recorded on the register.`,
      );
      if (!reason) return;

      setBusy(entry.id);
      try {
        await call(`/api/super-admin/subprocessors/${entry.id}`, "DELETE", { reason });
        toast.success(`${entry.name} retired.`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not retire.");
      } finally {
        setBusy(null);
      }
    },
    [call, router],
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-bs-fg">Sub-processors</h1>
          <p className="mt-2 max-w-2xl text-sm text-bs-fg-2">
            Vendors that process operator data. Operators are entitled to{" "}
            {minNoticeDays} days&apos; notice before a new one starts, and to
            object. Saving an entry tells nobody — announcing does.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-bs-green px-4 py-2 text-sm font-medium text-bs-bg hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add vendor
        </button>
      </header>

      {objections.length > 0 && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-bs-fg">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            {objections.length} open objection{objections.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-3 space-y-2 text-sm text-bs-fg-2">
            {objections.map((o) => (
              <li key={o.id}>
                <span className="text-bs-fg">{o.tenants.businessName}</span> objected
                to <span className="text-bs-fg">{o.subprocessor.name}</span> on{" "}
                {fmt(o.createdAt)}
                {o.outOfWindow && (
                  <span className="ml-2 text-amber-300">(outside the window)</span>
                )}
                <div className="mt-0.5 text-bs-fg-3">{o.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showForm && (
        <section className="grid gap-4 rounded-xl border border-bs-border p-5 sm:grid-cols-2">
          {[
            { k: "id", label: "Slug", placeholder: "postmark" },
            { k: "name", label: "Vendor name", placeholder: "Postmark" },
            { k: "purpose", label: "What they do", placeholder: "Transactional email delivery" },
            { k: "region", label: "Where they process", placeholder: "United States" },
            { k: "transferMechanism", label: "Transfer safeguard", placeholder: "EU SCCs + UK addendum" },
            { k: "dpaUrl", label: "DPA URL (optional)", placeholder: "https://…" },
          ].map((f) => (
            <div key={f.k}>
              <label className="block text-sm font-medium text-bs-fg">{f.label}</label>
              <input
                type="text"
                value={(draft as Record<string, string>)[f.k]}
                placeholder={f.placeholder}
                onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 text-sm text-bs-fg outline-none focus:border-bs-green"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-bs-fg">
              Starts processing
            </label>
            <input
              type="date"
              min={earliest}
              value={effectiveFrom || earliest}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 text-sm text-bs-fg outline-none focus:border-bs-green"
            />
            <p className="mt-1.5 text-xs text-bs-fg-2">
              Earliest is {earliest} — {minNoticeDays} days from today.
            </p>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={onCreate}
              disabled={busy === "create"}
              className="inline-flex items-center gap-2 rounded-lg border border-bs-border px-4 py-2 text-sm text-bs-fg hover:border-bs-green disabled:opacity-50"
            >
              {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save draft
            </button>
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-bs-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bs-bg-2 text-bs-fg-1">
            <tr>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Announced</th>
              <th className="px-4 py-3">Starts</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-bs-border align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-bs-fg">{entry.name}</div>
                  <div className="text-xs text-bs-fg-2">{entry.purpose}</div>
                  <div className="text-xs text-bs-fg-3">
                    {entry.region} · {entry.transferMechanism}
                  </div>
                  {entry.notes && (
                    <div className="mt-1 text-xs text-amber-300">{entry.notes}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {entry.status === "active" && (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> In force
                    </span>
                  )}
                  {entry.status === "pending" && (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Clock className="h-3.5 w-3.5" />
                      {entry.announcedAt ? "In notice" : "Not announced"}
                    </span>
                  )}
                  {entry.status === "retired" && (
                    <span className="text-bs-fg-3">Retired</span>
                  )}
                  {entry._count && entry._count.objections > 0 && (
                    <div className="mt-1 text-xs text-amber-300">
                      {entry._count.objections} objection(s)
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-bs-fg-2">{fmt(entry.announcedAt)}</td>
                <td className="px-4 py-3 text-bs-fg-2">{fmt(entry.effectiveFrom)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {entry.status === "pending" && !entry.announcedAt && (
                      <button
                        type="button"
                        onClick={() => onAnnounce(entry)}
                        disabled={busy === entry.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg hover:border-bs-green disabled:opacity-50"
                      >
                        {busy === entry.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Megaphone className="h-3.5 w-3.5" />
                        )}
                        Announce
                      </button>
                    )}
                    {entry.status !== "retired" && (
                      <button
                        type="button"
                        onClick={() => onRetire(entry)}
                        disabled={busy === entry.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg-2 hover:border-amber-400 disabled:opacity-50"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Retire
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
