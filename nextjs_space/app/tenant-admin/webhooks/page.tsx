"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  AlertTriangle,
  Info,
} from "lucide-react";
import { WEBHOOK_EVENT_CATEGORIES } from "@/lib/webhook-events";

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
  const { data: session } = useSession() || {};
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
      {/* Centered Header */}
      {/* Centered Header with Absolute Right Button */}
      <div className="relative mb-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="section-badge mb-4 inline-flex">
            <Webhook className="h-4 w-4" />
            Integrations
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Webhooks
          </h1>
          <p className="mt-3 text-muted-foreground mx-auto">
            Send real-time event notifications to external systems.
          </p>
        </div>
        <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="lg" className="rounded-xl shadow-lg hover:shadow-xl transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display text-xl">
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
                    className="mt-2 rounded-xl"
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
                    className="mt-2 rounded-xl"
                  />
                </div>

                <div>
                  <Label>Events to Subscribe *</Label>
                  <div className="mt-2 space-y-4 max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl p-4">
                    {WEBHOOK_EVENT_CATEGORIES.map((category) => (
                      <div key={category.name}>
                        <h4 className="font-medium mb-2">{category.name}</h4>
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
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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

                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    A unique secret will be generated for this webhook. Use it to
                    verify webhook signatures.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="hero"
                  className="rounded-xl"
                  onClick={handleCreate}
                >
                  Create Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Webhooks List */}
      {loading ? (
        <div className="card-floating p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="card-floating p-12 text-center">
          <div className="icon-badge mx-auto mb-4">
            <Webhook className="h-6 w-6 text-white" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">
            No webhooks configured
          </h3>
          <p className="text-muted-foreground mb-6">
            Create your first webhook to start receiving event notifications
          </p>
          <Button
            variant="hero"
            className="rounded-xl"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Webhook
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="card-floating p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-foreground truncate">
                      {webhook.url}
                    </h3>
                    {webhook.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700 gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {webhook.description || "No description"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => toggleWebhookActive(webhook)}
                  >
                    {webhook.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Subscribed Events
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Webhook Secret
                  </Label>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono">
                      {visibleSecrets.has(webhook.id)
                        ? webhook.secret
                        : maskSecret(webhook.secret)}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => toggleSecretVisibility(webhook.id)}
                    >
                      {visibleSecrets.has(webhook.id) ? "Hide" : "Show"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t border-slate-100">
                  <span>{webhook._count.deliveries} deliveries</span>
                  <span>•</span>
                  <span>
                    Created {new Date(webhook.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-accent"
                    onClick={() =>
                      window.open(
                        `/tenant-admin/webhooks/${webhook.id}/deliveries`,
                        "_blank"
                      )
                    }
                  >
                    View delivery logs
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Card */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-slate-500 p-3">
            <Info className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            How Webhooks Work
          </h2>
        </div>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            Webhooks send HTTP POST requests to your specified URL when events
            occur in your dispensary. Each request includes a signature header (
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
              X-Webhook-Signature
            </code>
            ) that you can use to verify authenticity.
          </p>
          <h4 className="font-display font-bold text-foreground mt-4 mb-2">
            Example Payload:
          </h4>
          <pre className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs overflow-x-auto">
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
          <h4 className="font-display font-bold text-foreground mt-4 mb-2">
            Verifying Signatures:
          </h4>
          <p>
            Use the webhook secret to verify the{" "}
            <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
              X-Webhook-Signature
            </code>{" "}
            header using HMAC SHA256.
          </p>
        </div>
      </div>
    </div>
  );
}
