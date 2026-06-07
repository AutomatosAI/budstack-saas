"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import {
  Webhook,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { WEBHOOK_EVENT_CATEGORIES } from "@/lib/integrations/webhook-events";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  _count: {
    deliveries: number;
  };
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    url: "",
    events: [] as string[],
    description: "",
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tenant-admin/webhooks");
      const data = await response.json();

      if (response.ok) {
        setWebhooks(data.webhooks);
      }
    } catch (error) {
      console.error("Failed to fetch webhooks:", error);
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.url || formData.events.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch("/api/tenant-admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Webhook created successfully");
        setIsCreateDialogOpen(false);
        setFormData({ url: "", events: [], description: "" });
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create webhook");
      }
    } catch (error) {
      console.error("Error creating webhook:", error);
      toast.error("Failed to create webhook");
    }
  };

  const handleUpdate = async (
    webhookId: string,
    updates: Partial<WebhookData>
  ) => {
    try {
      const response = await fetch(`/api/tenant-admin/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        toast.success("Webhook updated successfully");
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update webhook");
      }
    } catch (error) {
      console.error("Error updating webhook:", error);
      toast.error("Failed to update webhook");
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) {
      return;
    }

    try {
      const response = await fetch(`/api/tenant-admin/webhooks/${webhookId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Webhook deleted successfully");
        fetchWebhooks();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete webhook");
      }
    } catch (error) {
      console.error("Error deleting webhook:", error);
      toast.error("Failed to delete webhook");
    }
  };

  const toggleWebhookActive = async (webhook: WebhookData) => {
    await handleUpdate(webhook.id, { isActive: !webhook.isActive });
  };

  const handleEventToggle = (eventValue: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter((e) => e !== eventValue)
        : [...prev.events, eventValue],
    }));
  };

  const toggleSecretVisibility = (webhookId: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(webhookId)) {
        next.delete(webhookId);
      } else {
        next.add(webhookId);
      }
      return next;
    });
  };

  const maskSecret = (secret: string) => {
    if (!secret) return "";
    return "•".repeat(Math.min(secret.length, 16));
  };

  return (
    <div className="space-y-8">
      {/* Centered Header with Absolute Right Button */}
      <div className="relative">
        <div className="bs-page-header-centered">
        <h1 className="bs-page-title">Webhooks</h1>
          <p className="bs-page-subtitle">
            Send real-time event notifications to external systems.
          </p>
        </div>
        <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <button type="button" className="bs-btn bs-btn-green">
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Create Webhook
              </button>
            </DialogTrigger>
            <DialogContent className="bs-dialog-content max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-[22px] leading-tight" style={sectionTitleStyle}>
                  Create New Webhook
                </DialogTitle>
                <DialogDescription>
                  Add a webhook endpoint to receive real-time event notifications
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="url">Webhook URL *</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/webhook"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="e.g., Notify inventory system of stock changes"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Events to Subscribe *</Label>
                  <div className="mt-2 space-y-4 max-h-[300px] overflow-y-auto border border-bs-border-100 rounded-bs-md p-4">
                    {WEBHOOK_EVENT_CATEGORIES.map((category) => (
                      <div key={category.name}>
                        <h4 className="font-medium mb-2 text-bs-fg">{category.name}</h4>
                        <div className="space-y-2 ml-4">
                          {category.events.map((event) => (
                            <div
                              key={event.value}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={event.value}
                                checked={formData.events.includes(event.value)}
                                onCheckedChange={() =>
                                  handleEventToggle(event.value)
                                }
                              />
                              <label
                                htmlFor={event.value}
                                className="text-sm font-medium leading-none text-bs-fg peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {event.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-bs-md bg-bs-info/10 border border-bs-info/30 p-4 flex gap-3">
                  <Info className="h-5 w-5 text-bs-info flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-bs-fg">
                    A unique secret will be generated for this webhook. Use it to
                    verify webhook signatures.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <button
                  type="button"
                  className="bs-btn bs-btn-ghost"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="bs-btn bs-btn-green"
                  onClick={handleCreate}
                >
                  Create Webhook
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Webhooks List */}
      {loading ? (
        <div className="bs-card bs-card-pad text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-bs-green" aria-hidden="true" />
          <p className="text-bs-fg-muted">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bs-card bs-card-pad text-center py-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bs-green/10 text-bs-green mx-auto mb-4">
            <Webhook className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-[22px] leading-tight mb-2" style={sectionTitleStyle}>
            No webhooks configured
          </h3>
          <p className="text-bs-fg-muted mb-6">
            Create your first webhook to start receiving event notifications
          </p>
          <button
            type="button"
            className="bs-btn bs-btn-green"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="bs-card bs-card-pad">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-bs-fg truncate font-mono text-sm">
                      {webhook.url}
                    </h3>
                    {webhook.isActive ? (
                      <span className="bs-chip bs-chip-green inline-flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="bs-chip bs-chip-muted inline-flex items-center gap-1">
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-bs-fg-muted">
                    {webhook.description || "No description"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm"
                    onClick={() => toggleWebhookActive(webhook)}
                  >
                    {webhook.isActive ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="bs-btn bs-btn-ghost bs-btn-sm text-bs-danger hover:bg-bs-danger/10"
                    onClick={() => handleDelete(webhook.id)}
                    aria-label="Delete webhook"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="bs-eyebrow">Subscribed Events</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {webhook.events.map((event) => (
                      <span key={event} className="bs-chip bs-chip-muted text-xs font-mono">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="bs-eyebrow">Webhook Secret</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 p-3 bg-bs-canvas border border-bs-border-100 rounded-bs-sm text-xs font-mono text-bs-fg">
                      {visibleSecrets.has(webhook.id)
                        ? webhook.secret
                        : maskSecret(webhook.secret)}
                    </code>
                    <button
                      type="button"
                      className="bs-btn bs-btn-ghost bs-btn-sm"
                      onClick={() => toggleSecretVisibility(webhook.id)}
                    >
                      {visibleSecrets.has(webhook.id) ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-bs-fg-muted pt-2 border-t border-bs-border-100">
                  <span>{webhook._count.deliveries} deliveries</span>
                  <span>•</span>
                  <span>
                    Created {new Date(webhook.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-xs text-bs-green hover:underline inline-flex items-center"
                    onClick={() =>
                      window.open(
                        `/tenant-admin/webhooks/${webhook.id}/deliveries`,
                        "_blank"
                      )
                    }
                  >
                    View delivery logs
                    <ExternalLink className="h-3 w-3 ml-1" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Card */}
      <div className="bs-card bs-card-pad">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-bs-md bg-bs-card-2 border border-bs-border-100 p-3 inline-flex items-center justify-center">
            <Info className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
          </div>
          <h2 className="text-[22px] leading-tight" style={sectionTitleStyle}>
            How Webhooks Work
          </h2>
        </div>
        <div className="text-sm text-bs-fg-muted space-y-3">
          <p>
            Webhooks send HTTP POST requests to your specified URL when events
            occur in your dispensary. Each request includes a signature header (
            <code className="text-xs bg-bs-canvas border border-bs-border-100 px-1.5 py-0.5 rounded text-bs-fg font-mono">
              X-Webhook-Signature
            </code>
            ) that you can use to verify authenticity.
          </p>
          <h4 className="text-base font-semibold text-bs-fg mt-4 mb-2" style={sectionTitleStyle}>
            Example Payload:
          </h4>
          <pre className="bg-bs-canvas border border-bs-border-100 p-4 rounded-bs-md text-xs overflow-x-auto font-mono text-bs-fg">
{`{
  "event": "order.created",
  "tenantId": "your-tenant-id",
  "data": {
    "orderId": "ord_123",
    "total": 125.50,
    "customerId": "usr_456"
  },
  "timestamp": "2025-11-24T12:00:00Z"
}`}
          </pre>
          <h4 className="text-base font-semibold text-bs-fg mt-4 mb-2" style={sectionTitleStyle}>
            Verifying Signatures:
          </h4>
          <p>
            Use the webhook secret to verify the{" "}
            <code className="text-xs bg-bs-canvas border border-bs-border-100 px-1.5 py-0.5 rounded text-bs-fg font-mono">
              X-Webhook-Signature
            </code>{" "}
            header using HMAC SHA256.
          </p>
        </div>
      </div>
    </div>
  );
}
