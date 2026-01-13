"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import {
  Webhook,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { WEBHOOK_EVENT_CATEGORIES } from "@/lib/webhook";
import { Breadcrumbs } from "@/components/admin/shared";

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookData | null>(
    null,
  );

  // Form state
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
    updates: Partial<WebhookData>,
  ) => {
    try {
      const response = await fetch(`/api/tenant-admin/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        toast.success("Webhook updated successfully");
        setIsEditDialogOpen(false);
        setEditingWebhook(null);
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

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/tenant-admin" },
          { label: "Webhooks" },
        ]}
        className="mb-4"
      />

      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Webhooks
            </h1>
            <p className="text-slate-600 mt-2">
              Send real-time event notifications to external systems
            </p>
          </div>
          <Dialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Webhook</DialogTitle>
                <DialogDescription>
                  Add a webhook endpoint to receive real-time event
                  notifications
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
                  />
                </div>

                <div>
                  <Label>Events to Subscribe *</Label>
                  <div className="mt-2 space-y-4 max-h-[300px] overflow-y-auto border rounded-lg p-4">
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

                <Alert>
                  <AlertDescription>
                    A unique secret will be generated for this webhook. Use it
                    to verify webhook signatures.
                  </AlertDescription>
                </Alert>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create Webhook</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center">
            Loading webhooks...
          </CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Webhook className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              No webhooks configured
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your first webhook to start receiving event notifications
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{webhook.url}</CardTitle>
                      {webhook.isActive ? (
                        <Badge variant="default" className="gap-1">
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
                    <CardDescription>
                      {webhook.description || "No description"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWebhookActive(webhook)}
                    >
                      {webhook.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Subscribed Events
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.map((event) => (
                        <Badge
                          key={event}
                          variant="outline"
                          className="text-xs"
                        >
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Webhook Secret
                    </Label>
                    <code className="block mt-1 p-2 bg-muted rounded text-xs font-mono">
                      {webhook.secret}
                    </code>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{webhook._count.deliveries} deliveries</span>
                    <span>•</span>
                    <span>
                      Created {new Date(webhook.createdAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() =>
                        window.open(
                          `/tenant-admin/webhooks/${webhook.id}/deliveries`,
                          "_blank",
                        )
                      }
                    >
                      View delivery logs
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Help Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">How Webhooks Work</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            Webhooks send HTTP POST requests to your specified URL when events
            occur in your dispensary. Each request includes a signature header (
            <code>X-Webhook-Signature</code>) that you can use to verify
            authenticity.
          </p>
          <h4>Example Payload:</h4>
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
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
          <h4>Verifying Signatures:</h4>
          <p>
            Use the webhook secret to verify the{" "}
            <code>X-Webhook-Signature</code> header using HMAC SHA256.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
