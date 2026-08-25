"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import {
  Webhook,
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Loader2,
  Plus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { WEBHOOK_EVENT_CATEGORIES } from "@/lib/integrations/webhook-events";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface InboundStatus {
  configured: boolean;
  source: "database" | "environment" | null;
  isEnabled: boolean;
  tableProvisioned: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Delivery {
  id: string;
  tenantId: string;
  clientId: string | null;
  event: string;
  processed: boolean;
  error: string | null;
  createdAt: string;
}

interface OutboundWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description?: string;
  createdAt: string;
  secretPreview: string;
  _count: { deliveries: number };
}

/**
 * Platform Webhooks — super-admin.
 *
 * Two directions, one console:
 *  - INBOUND: the Dr Green → BudStacks status feed. There is no URL to add
 *    (the receiving endpoint is ours, fixed in code); what an operator manages
 *    is the shared verification secret, the on/off switch, and visibility of
 *    what actually arrived.
 *  - OUTBOUND: platform-scope destinations (`webhooks` rows with tenantId
 *    null). Tenants manage their own under tenant-admin → Webhooks.
 */
export default function PlatformWebhooksPage() {
  const [loading, setLoading] = useState(true);
  const [inbound, setInbound] = useState<InboundStatus | null>(null);
  const [receivingPath, setReceivingPath] = useState("/api/webhooks/drgreen/status");
  const [stats, setStats] = useState({ total: 0, processed: 0, failed: 0 });
  const [recent, setRecent] = useState<Delivery[]>([]);
  const [secretInput, setSecretInput] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);

  const [outbound, setOutbound] = useState<OutboundWebhook[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ url: "", events: [] as string[], description: "" });

  const loadInbound = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/webhooks/inbound");
      if (!res.ok) throw new Error("Failed to load inbound status");
      const data = await res.json();
      setInbound(data.status);
      setStats(data.stats);
      setRecent(data.recent);
      if (data.receivingPath) setReceivingPath(data.receivingPath);
    } catch {
      toast.error("Could not load inbound webhook status");
    }
  }, []);

  const loadOutbound = useCallback(async () => {
    try {
      const res = await fetch("/api/super-admin/webhooks/outbound");
      if (!res.ok) throw new Error("Failed to load outbound webhooks");
      const data = await res.json();
      setOutbound(data.webhooks ?? []);
    } catch {
      toast.error("Could not load platform webhooks");
    }
  }, []);

  useEffect(() => {
    Promise.all([loadInbound(), loadOutbound()]).finally(() => setLoading(false));
  }, [loadInbound, loadOutbound]);

  const receivingUrl =
    typeof window !== "undefined" ? `${window.location.origin}${receivingPath}` : receivingPath;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const saveSecret = async () => {
    if (secretInput.trim().length < 16) {
      toast.error("Secret must be at least 16 characters");
      return;
    }
    setSavingSecret(true);
    try {
      const res = await fetch("/api/super-admin/webhooks/inbound", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      setInbound(data.status);
      setSecretInput("");
      toast.success("Secret saved. Dr Green must sign with this exact value.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingSecret(false);
    }
  };

  const toggleInbound = async (isEnabled: boolean) => {
    try {
      const res = await fetch("/api/super-admin/webhooks/inbound", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setInbound(data.status);
      toast.success(isEnabled ? "Inbound webhooks enabled" : "Inbound webhooks disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const createOutbound = async () => {
    if (!form.url || form.events.length === 0) {
      toast.error("A URL and at least one event are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/super-admin/webhooks/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Create failed");
      setForm({ url: "", events: [], description: "" });
      await loadOutbound();
      if (data.webhook?.secret) {
        await copy(data.webhook.secret, "Signing secret");
        toast.success("Endpoint created — signing secret copied (shown only once)");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteOutbound = async (id: string) => {
    try {
      const res = await fetch(`/api/super-admin/webhooks/outbound/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await loadOutbound();
      toast.success("Endpoint removed");
    } catch {
      toast.error("Could not remove endpoint");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-bs-fg-muted">
        <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
        Loading webhooks…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="bs-page-header-centered">
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Platform Webhooks
        </h1>
        <p className="bs-page-subtitle">
          Platform-scope only. A tenant&apos;s own destinations live under
          tenant-admin → Webhooks.
        </p>
      </header>

      {/* ─── INBOUND ─────────────────────────────────────────── */}
      <section className="bs-card bs-card-pad space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
              <ArrowDownToLine className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[22px] text-bs-fg" style={sectionTitleStyle}>
                Incoming — Dr Green status feed
              </h2>
              <p className="text-sm text-bs-fg-muted">
                Client approval and KYC events pushed to us, verified by a shared secret.
              </p>
            </div>
          </div>
          {inbound?.configured ? (
            <span className="bs-chip bs-chip-green shrink-0">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Secret configured
            </span>
          ) : (
            <span className="bs-chip bs-chip-warn shrink-0">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Not configured
            </span>
          )}
        </div>

        {inbound && !inbound.tableProvisioned && (
          <div className="flex gap-2 rounded-bs-sm border border-bs-border-100 bg-bs-card-2 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-bs-warn" aria-hidden="true" />
            <p className="text-bs-fg-muted">
              The <code className="font-mono">platform_webhook_config</code> table is not
              provisioned yet, so settings cannot be saved. Inbound verification is still
              running from the environment variable. Apply{" "}
              <code className="font-mono">
                prisma/migrations/add_platform_webhook_config.sql
              </code>{" "}
              to enable management here.
            </p>
          </div>
        )}

        <div>
          <Label className="text-xs">Endpoint Dr Green posts to</Label>
          <div className="mt-1 flex gap-2">
            <Input readOnly value={receivingUrl} className="font-mono text-xs" />
            <button
              type="button"
              onClick={() => copy(receivingUrl, "Endpoint URL")}
              className="bs-btn bs-btn-ghost bs-btn-sm shrink-0"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-[11px] text-bs-fg-muted">
            Fixed in code — there is no inbound URL to configure, only the secret below.
          </p>
        </div>

        <div className="border-t border-bs-border-100 pt-4">
          <Label htmlFor="inbound-secret" className="text-xs">
            Shared verification secret
          </Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="inbound-secret"
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder={
                inbound?.configured
                  ? "Enter a new value to rotate"
                  : "Paste the secret Dr Green signs with"
              }
              className="font-mono"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={saveSecret}
              disabled={savingSecret || !inbound?.tableProvisioned}
              className="bs-btn bs-btn-green bs-btn-sm shrink-0 disabled:opacity-50"
            >
              {savingSecret ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : inbound?.configured ? (
                "Rotate"
              ) : (
                "Save"
              )}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-bs-fg-muted">
            Stored encrypted and never displayed again.{" "}
            {inbound?.source === "environment" &&
              "Currently using the DRGREEN_WEBHOOK_SECRET environment variable — saving here overrides it. "}
            {inbound?.updatedAt &&
              `Last rotated ${new Date(inbound.updatedAt).toLocaleString()}${
                inbound.updatedBy ? ` by ${inbound.updatedBy}` : ""
              }.`}
          </p>
          <p className="mt-2 text-[11px] text-bs-warn">
            Rotation is two-sided: Dr Green must change{" "}
            <code className="font-mono">PARTNER_STATUS_WEBHOOK_SECRET</code> to the same
            value, or deliveries will fail signature verification until they do.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-bs-border-100 pt-4">
          <div>
            <Label className="text-xs">Accept incoming events</Label>
            <p className="text-[11px] text-bs-fg-muted">
              Off rejects every delivery, valid signature or not.
            </p>
          </div>
          <Switch
            checked={inbound?.isEnabled ?? true}
            onCheckedChange={toggleInbound}
            disabled={!inbound?.tableProvisioned}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-bs-border-100 pt-4">
          {[
            { label: "Received", value: stats.total },
            { label: "Processed", value: stats.processed },
            { label: "Errored", value: stats.failed },
          ].map((s) => (
            <div key={s.label} className="rounded-bs-sm border border-bs-border-100 p-3">
              <p className="font-mono text-xl tabular-nums text-bs-fg">{s.value}</p>
              <p className="text-[11px] text-bs-fg-muted">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-bs-border-100 pt-4">
          <p className="bs-eyebrow mb-2">Recent deliveries</p>
          {recent.length === 0 ? (
            <p className="text-sm text-bs-fg-muted">
              Nothing received yet. Events appear here once Dr Green starts sending.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="bs-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Event</th>
                    <th className="text-left hidden md:table-cell">Client</th>
                    <th className="text-left">Status</th>
                    <th className="text-left hidden sm:table-cell">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((d) => (
                    <tr key={d.id}>
                      <td className="font-mono text-xs">{d.event}</td>
                      <td className="hidden md:table-cell font-mono text-xs text-bs-fg-muted">
                        {d.clientId ? `${d.clientId.slice(0, 12)}…` : "—"}
                      </td>
                      <td>
                        <span
                          className={`bs-chip ${
                            d.error
                              ? "bs-chip-danger"
                              : d.processed
                                ? "bs-chip-green"
                                : "bs-chip-warn"
                          }`}
                          title={d.error ?? undefined}
                        >
                          {d.error ? "Error" : d.processed ? "Processed" : "Pending"}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell font-mono text-xs text-bs-fg-muted">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ─── OUTBOUND ────────────────────────────────────────── */}
      <section className="bs-card bs-card-pad space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
            <ArrowUpFromLine className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[22px] text-bs-fg" style={sectionTitleStyle}>
              Outgoing — platform endpoints
            </h2>
            <p className="text-sm text-bs-fg-muted">
              Fires on platform-level events only, not on individual tenants&apos; activity.
            </p>
          </div>
        </div>

        {outbound.length === 0 ? (
          <p className="text-sm text-bs-fg-muted">No platform endpoints yet.</p>
        ) : (
          <div className="space-y-2">
            {outbound.map((w) => (
              <div
                key={w.id}
                className="flex items-start justify-between gap-3 rounded-bs-sm border border-bs-border-100 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-bs-fg">{w.url}</p>
                  <p className="mt-1 text-[11px] text-bs-fg-muted">
                    {w.events.length} event{w.events.length === 1 ? "" : "s"} ·{" "}
                    {w._count.deliveries} deliveries · secret {w.secretPreview}
                  </p>
                  {w.description && (
                    <p className="mt-1 text-[11px] text-bs-fg-muted">{w.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteOutbound(w.id)}
                  className="bs-btn bs-btn-ghost bs-btn-sm shrink-0 text-bs-danger"
                  aria-label="Remove endpoint"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-bs-border-100 pt-4">
          <p className="bs-eyebrow">Add endpoint</p>
          <div>
            <Label htmlFor="outbound-url" className="text-xs">
              URL
            </Label>
            <Input
              id="outbound-url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com/hooks/budstacks"
              className="mt-1 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-bs-fg-muted">
              Public HTTPS only — internal addresses are rejected.
            </p>
          </div>

          <div>
            <Label className="text-xs">Events</Label>
            <div className="mt-1 max-h-48 space-y-3 overflow-y-auto rounded-bs-sm border border-bs-border-100 p-3">
              {WEBHOOK_EVENT_CATEGORIES.map((category) => (
                <div key={category.name}>
                  <p className="bs-eyebrow mb-1">{category.name}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {category.events.map((event) => (
                      <label key={event.value} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={form.events.includes(event.value)}
                          onCheckedChange={(checked) =>
                            setForm((f) => ({
                              ...f,
                              events: checked
                                ? [...f.events, event.value]
                                : f.events.filter((e) => e !== event.value),
                            }))
                          }
                        />
                        {event.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="outbound-desc" className="text-xs">
              Description (optional)
            </Label>
            <Textarea
              id="outbound-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1"
            />
          </div>

          <button
            type="button"
            onClick={createOutbound}
            disabled={creating}
            className="bs-btn bs-btn-green bs-btn-sm disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            Add endpoint
          </button>
          <p className="text-[11px] text-bs-fg-muted">
            The signing secret is shown and copied once, at creation.
          </p>
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-bs-fg-muted">
        <Webhook className="h-3 w-3" aria-hidden="true" />
        Inbound events are routed to the owning tenant automatically by client id.
      </p>
    </div>
  );
}
