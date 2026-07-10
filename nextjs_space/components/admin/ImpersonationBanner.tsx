"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, LogOut, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface ImpersonationBannerProps {
  sessionId: string;
  tenantName: string;
  tenantEmail: string | null;
  superAdminEmail: string;
  /** ISO strings — server components can't pass Date across the boundary. */
  startedAt: string;
  expiresAt: string;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * PRD-302 AC-2: the always-visible red impersonation banner. Rendered by the
 * tenant-admin layout on EVERY page while a super-admin is impersonating —
 * cannot be dismissed, only exited. Elapsed time re-renders every 10 seconds.
 */
export function ImpersonationBanner({
  sessionId,
  tenantName,
  tenantEmail,
  superAdminEmail,
  startedAt,
  expiresAt,
}: ImpersonationBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = formatElapsed(now - new Date(startedAt).getTime());
  const expired = now >= new Date(expiresAt).getTime();

  async function exitImpersonation() {
    setExiting(true);
    try {
      const res = await fetch("/api/super-admin/impersonation/end", {
        method: "POST",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || "Failed to end impersonation");
      }
      // Full navigation (not router.push) so every layout/page re-renders
      // without the impersonated tenant context.
      window.location.href = "/super-admin/impersonation";
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to end impersonation",
      );
      setExiting(false);
    }
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 bg-red-600 px-4 py-2 text-white shadow-md"
    >
      <span className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        YOU ARE LOGGED IN AS: {tenantName}
        {tenantEmail ? (
          <span className="font-normal opacity-90">({tenantEmail})</span>
        ) : null}
      </span>
      <span className="text-sm opacity-90">
        Super-Admin: {superAdminEmail} · Session {sessionId.slice(0, 8)} ·{" "}
        {expired ? "EXPIRED — exit and start a new session" : `Elapsed: ${elapsed}`}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <Link
          href={`/super-admin/impersonation/${sessionId}/audit-log`}
          className="inline-flex items-center gap-1 rounded border border-white/40 px-2 py-1 text-xs font-medium hover:bg-white/10"
        >
          <FileText className="h-3 w-3" aria-hidden /> Audit log
        </Link>
        <button
          type="button"
          onClick={exitImpersonation}
          disabled={exiting}
          className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {exiting ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <LogOut className="h-3 w-3" aria-hidden />
          )}
          Exit Impersonation
        </button>
      </span>
    </div>
  );
}
