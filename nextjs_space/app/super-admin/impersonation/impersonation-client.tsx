"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  UserCog,
  Search,
  Loader2,
  FileText,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface SessionRow {
  id: string;
  superAdminEmail: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string | null;
  startedAt: string;
  endedAt: string | null;
  endedReason: string | null;
  durationSeconds: number;
  status: "active" | "completed";
  ipAddress: string | null;
  notes: string | null;
}

interface TenantHit {
  id: string;
  businessName: string;
  subdomain: string;
  countryCode: string;
}

interface ImpersonationClientProps {
  currentSuperAdminEmail: string;
  maxHours: number;
  initialSessions: SessionRow[];
  initialTotal: number;
}

type StatusFilter = "all" | "active" | "completed";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ImpersonationClient({
  currentSuperAdminEmail,
  maxHours,
  initialSessions,
  initialTotal,
}: ImpersonationClientProps) {
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions);
  const [total, setTotal] = useState(initialTotal);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TenantHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const [target, setTarget] = useState<TenantHit | null>(null);
  const [notes, setNotes] = useState("");
  const [starting, setStarting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);

  // Debounced tenant autocomplete (AC-1). Sequence guard drops stale responses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/super-admin/tenants/search?q=${encodeURIComponent(q)}`,
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Search failed");
        if (searchSeq.current === seq) setHits(payload.tenants ?? []);
      } catch {
        if (searchSeq.current === seq) setHits([]);
      } finally {
        if (searchSeq.current === seq) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function refetchSessions(nextFilter: StatusFilter) {
    setLoadingSessions(true);
    try {
      const res = await fetch(
        `/api/super-admin/impersonation/sessions?status=${nextFilter}&limit=50`,
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to load sessions");
      setSessions(payload.sessions ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load sessions",
      );
    } finally {
      setLoadingSessions(false);
    }
  }

  function changeFilter(next: StatusFilter) {
    setFilter(next);
    void refetchSessions(next);
  }

  async function startImpersonation() {
    if (!target) return;
    setStarting(true);
    try {
      const res = await fetch("/api/super-admin/impersonation/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: target.id,
          notes: notes.trim() || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to start impersonation");
      toast.success(`Impersonating ${target.businessName}`);
      // Full navigation so every layout re-renders with the impersonated tenant.
      window.location.href = payload.impersonationUrl || "/tenant-admin";
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start impersonation",
      );
      setStarting(false);
    }
  }

  async function endSession(sessionId: string) {
    setEndingId(sessionId);
    try {
      const res = await fetch("/api/super-admin/impersonation/end", {
        method: "POST",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to end session");
      toast.success("Impersonation session ended");
      await refetchSessions(filter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end session");
    } finally {
      setEndingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="bs-page-title flex items-center gap-2">
          <UserCog className="h-6 w-6" aria-hidden /> Impersonation Sessions
        </h1>
        <p className="bs-page-subtitle">
          Temporarily log in as a tenant to reproduce and fix issues. Every
          action is audit-logged with your super-admin identity.
        </p>
      </header>

      <section className="bs-card">
        <div className="bs-card-pad space-y-4">
          <h2 className="bs-eyebrow">Impersonate a tenant</h2>
          <div className="relative max-w-xl">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bs-fg-muted"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tenants by name or subdomain…"
              className="pl-9"
              aria-label="Search tenants"
            />
          </div>
          {query.trim().length >= 2 && (
            <div className="max-w-xl divide-y divide-bs-border-100 rounded border border-bs-border-100">
              {searching && (
                <p className="flex items-center gap-2 p-3 text-sm text-bs-fg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Searching…
                </p>
              )}
              {!searching && hits.length === 0 && (
                <p className="p-3 text-sm text-bs-fg-muted">
                  No active tenants match “{query.trim()}”.
                </p>
              )}
              {!searching &&
                hits.map((hit) => (
                  <div
                    key={hit.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div>
                      <p className="font-medium">{hit.businessName}</p>
                      <p className="text-sm text-bs-fg-muted">
                        {hit.subdomain} · {hit.countryCode}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setTarget(hit)}>
                      Impersonate
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      <section className="bs-card">
        <div className="bs-card-pad">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="bs-eyebrow">
              Sessions ({total}
              {filter !== "all" ? ` ${filter}` : ""})
            </h2>
            <div className="flex gap-1">
              {(["all", "active", "completed"] as StatusFilter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "ghost"}
                  onClick={() => changeFilter(f)}
                  disabled={loadingSessions}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="bs-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Tenant</th>
                  <th className="text-left">Super-Admin</th>
                  <th className="text-left">Started</th>
                  <th className="text-left">Duration</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">IP</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-bs-fg-muted">
                      No impersonation sessions yet.
                    </td>
                  </tr>
                )}
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="font-medium">{s.tenantName}</span>
                      {s.notes && (
                        <span
                          className="block max-w-[28ch] truncate text-xs text-bs-fg-muted"
                          title={s.notes}
                        >
                          {s.notes}
                        </span>
                      )}
                    </td>
                    <td>{s.superAdminEmail}</td>
                    {/* Locale/TZ-formatted: server renders UTC, client renders
                        the viewer's zone — suppress the expected 1-level mismatch. */}
                    <td title={s.startedAt} suppressHydrationWarning>
                      {new Date(s.startedAt).toLocaleString()}
                    </td>
                    <td>{formatDuration(s.durationSeconds)}</td>
                    <td>
                      {s.status === "active" ? (
                        <Badge className="bg-red-600 text-white hover:bg-red-600">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {s.endedReason === "timeout" ? "Expired" : "Completed"}
                        </Badge>
                      )}
                    </td>
                    <td>{s.ipAddress ?? "—"}</td>
                    <td className="text-right">
                      <span className="inline-flex items-center gap-1">
                        {s.status === "active" &&
                          s.superAdminEmail === currentSuperAdminEmail && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={endingId === s.id}
                              onClick={() => endSession(s.id)}
                            >
                              {endingId === s.id ? (
                                <Loader2
                                  className="h-4 w-4 animate-spin"
                                  aria-hidden
                                />
                              ) : (
                                <>
                                  <LogOut className="mr-1 h-4 w-4" aria-hidden />
                                  End
                                </>
                              )}
                            </Button>
                          )}
                        <Link
                          href={`/super-admin/impersonation/${s.id}/audit-log`}
                        >
                          <Button variant="ghost" size="sm">
                            <FileText className="mr-1 h-4 w-4" aria-hidden />
                            View log
                          </Button>
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Dialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open && !starting) {
            setTarget(null);
            setNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden />
              Impersonate {target?.businessName}?
            </DialogTitle>
            <DialogDescription>
              You will be logged in as this tenant&apos;s admin. Every action is
              recorded in the audit trail with your identity
              {currentSuperAdminEmail ? ` (${currentSuperAdminEmail})` : ""}.
              The session expires automatically after {maxHours}{" "}
              {maxHours === 1 ? "hour" : "hours"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="impersonation-notes">
              Reason (optional, shown in the sessions table)
            </Label>
            <Textarea
              id="impersonation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Support ticket #4821 — customer can't see orders"
              maxLength={1000}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTarget(null);
                setNotes("");
              }}
              disabled={starting}
            >
              Cancel
            </Button>
            <Button onClick={startImpersonation} disabled={starting}>
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserCog className="mr-2 h-4 w-4" aria-hidden />
              )}
              Impersonate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
