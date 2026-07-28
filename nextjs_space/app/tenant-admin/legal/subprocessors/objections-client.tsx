"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Loader2, ShieldQuestion } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface Entry {
  id: string;
  name: string;
  purpose: string;
  region: string;
  transferMechanism: string;
  status: string;
  effectiveFrom: string;
  announcedAt: string | null;
}

interface Objection {
  id: string;
  reason: string;
  status: string;
  outOfWindow: boolean;
  createdAt: string;
  subprocessor: { name: string };
}

interface Props {
  entries: Entry[];
  objections: Objection[];
  objectionWindowDays: number;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function OperatorSubprocessorView({
  entries,
  objections,
  objectionWindowDays,
}: Props) {
  const router = useRouter();
  const [objectingTo, setObjectingTo] = useState<Entry | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = entries.filter((e) => e.status === "pending");

  const submit = useCallback(async () => {
    if (!objectingTo) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tenant-admin/subprocessor-objections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subprocessorId: objectingTo.id, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not record your objection.");

      toast.success(json.message ?? "Objection recorded.");
      setObjectingTo(null);
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [objectingTo, reason, router]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-bs-fg">Who processes your data</h1>
        <p className="mt-2 max-w-2xl text-sm text-bs-fg-2">
          These are the vendors BudStacks uses to run your storefront. You are
          told at least 30 days before a new one starts, and you have{" "}
          {objectionWindowDays} days from that notice to object.
        </p>
      </header>

      {pending.length > 0 && (
        <section className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-bs-fg">
            <Clock className="h-4 w-4 text-amber-400" />
            {pending.length} upcoming change{pending.length === 1 ? "" : "s"}
          </div>
          <p className="mt-1 text-sm text-bs-fg-2">
            Not processing yet. If you object, do it before the start date below.
          </p>
        </section>
      )}

      {objections.length > 0 && (
        <section className="rounded-xl border border-bs-border p-5">
          <h2 className="text-sm font-medium text-bs-fg">Your objections</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {objections.map((o) => (
              <li key={o.id} className="text-bs-fg-2">
                <span className="text-bs-fg">{o.subprocessor.name}</span> —{" "}
                {fmt(o.createdAt)} · {o.status}
                {o.outOfWindow && (
                  <span className="ml-2 text-amber-300">(raised late)</span>
                )}
                <div className="text-bs-fg-3">{o.reason}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-bs-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-bs-bg-2 text-bs-fg-1">
            <tr>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Where</th>
              <th className="px-4 py-3">Safeguard</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-bs-border align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-bs-fg">{entry.name}</div>
                  <div className="text-xs text-bs-fg-2">{entry.purpose}</div>
                </td>
                <td className="px-4 py-3 text-bs-fg-2">{entry.region}</td>
                <td className="px-4 py-3 text-bs-fg-2">{entry.transferMechanism}</td>
                <td className="px-4 py-3 text-bs-fg-2">
                  {entry.status === "active" ? (
                    "In use"
                  ) : (
                    <span className="text-amber-300">
                      From {fmt(entry.effectiveFrom)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setObjectingTo(entry)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-bs-border px-3 py-1.5 text-xs text-bs-fg-2 hover:border-amber-400"
                  >
                    <ShieldQuestion className="h-3.5 w-3.5" />
                    Object
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {objectingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-bs-border bg-bs-bg p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <h2 className="text-base font-medium text-bs-fg">
                  Object to {objectingTo.name}
                </h2>
                <p className="mt-1 text-sm text-bs-fg-2">
                  Tell us why. We record it against this vendor and respond
                  before the change takes effect.
                </p>
              </div>
            </div>

            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. our own DPA with a client prohibits processing outside the EEA"
              className="mt-4 w-full rounded-lg border border-bs-border bg-transparent px-3 py-2 text-sm text-bs-fg outline-none focus:border-bs-green"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setObjectingTo(null);
                  setReason("");
                }}
                className="rounded-lg border border-bs-border px-4 py-2 text-sm text-bs-fg-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || reason.trim().length < 10}
                className="inline-flex items-center gap-2 rounded-lg bg-bs-green px-4 py-2 text-sm font-medium text-bs-bg disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit objection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
