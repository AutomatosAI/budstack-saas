"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  BookOpen,
  Play,
  FileText,
  GripVertical,
  ExternalLink,
} from "lucide-react";

type Resource = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  category: string;
  type: string;
  videoUrl: string | null;
  docUrl: string | null;
  coverImage: string | null;
  tags: string[];
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
};

const CATEGORIES = [
  { value: "getting-started", label: "Getting Started" },
  { value: "templates", label: "Templates" },
  { value: "orders", label: "Orders & Products" },
  { value: "integrations", label: "Integrations" },
  { value: "branding", label: "Branding & Design" },
  { value: "general", label: "General" },
];

const TYPES = [
  { value: "article", label: "Article", icon: BookOpen },
  { value: "video", label: "Video", icon: Play },
  { value: "guide", label: "Guide", icon: FileText },
];

function ResourceForm({
  resource,
  onSave,
  onClose,
}: {
  resource?: Resource;
  onSave: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (resource) {
      formData.set("id", resource.id);
    }

    try {
      const res = await fetch("/api/super-admin/learning", {
        method: resource ? "PUT" : "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={resource?.title}
            required
            placeholder="How to customize your template"
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select name="category" defaultValue={resource?.category || "general"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue={resource?.type || "article"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Short Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={resource?.description || ""}
          placeholder="A brief summary shown on the card"
        />
      </div>

      <div>
        <Label htmlFor="content">Content (Markdown)</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={resource?.content || ""}
          placeholder="Write your article content in markdown..."
          rows={12}
          className="font-mono text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="videoUrl">Video URL (YouTube/Vimeo)</Label>
          <Input
            id="videoUrl"
            name="videoUrl"
            defaultValue={resource?.videoUrl || ""}
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>

        <div>
          <Label htmlFor="docUrl">External Doc URL</Label>
          <Input
            id="docUrl"
            name="docUrl"
            defaultValue={resource?.docUrl || ""}
            placeholder="https://docs.example.com/..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="coverImage">Cover Image</Label>
          <Input
            id="coverImage"
            name="coverImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </div>

        <div>
          <Label htmlFor="docFile">Upload Document (PDF)</Label>
          <Input
            id="docFile"
            name="docFile"
            type="file"
            accept="application/pdf,text/css,application/json"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            name="tags"
            defaultValue={resource?.tags?.join(", ") || ""}
            placeholder="setup, beginner, customization"
          />
        </div>

        <div>
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={resource?.sortOrder || 0}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isPublished"
          name="isPublished"
          value="true"
          defaultChecked={resource?.isPublished ?? false}
          className="rounded"
        />
        <Label htmlFor="isPublished" className="cursor-pointer">
          Published (visible on public site)
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading
            ? "Saving..."
            : resource
              ? "Update Resource"
              : "Create Resource"}
        </Button>
      </div>
    </form>
  );
}

export function LearningManager({
  initialResources,
}: {
  initialResources: Resource[];
}) {
  const router = useRouter();
  const [resources, setResources] = useState(initialResources);
  const [editingResource, setEditingResource] = useState<Resource | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleRefresh = () => {
    router.refresh();
    // Also re-fetch client-side for immediate update
    fetch("/api/super-admin/learning")
      .then((r) => r.json())
      .then((data) => setResources(data.resources))
      .catch(console.error);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this resource? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await fetch("/api/super-admin/learning", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePublish = async (resource: Resource) => {
    const formData = new FormData();
    formData.set("id", resource.id);
    formData.set("isPublished", (!resource.isPublished).toString());
    try {
      await fetch("/api/super-admin/learning", {
        method: "PUT",
        body: formData,
      });
      setResources((prev) =>
        prev.map((r) =>
          r.id === resource.id ? { ...r, isPublished: !r.isPublished } : r,
        ),
      );
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "video":
        return <Play className="h-4 w-4" />;
      case "guide":
        return <FileText className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div>
      {/* Actions bar */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-muted-foreground">
          {resources.length} resource{resources.length !== 1 ? "s" : ""}
        </p>
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            setShowForm(open);
            if (!open) setEditingResource(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingResource(undefined)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingResource ? "Edit Resource" : "New Resource"}
              </DialogTitle>
              <DialogDescription>
                {editingResource
                  ? "Update the learning resource details."
                  : "Create a new doc, guide, or video for the learning center."}
              </DialogDescription>
            </DialogHeader>
            <ResourceForm
              resource={editingResource}
              onSave={handleRefresh}
              onClose={() => {
                setShowForm(false);
                setEditingResource(undefined);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Resource list */}
      <div className="space-y-3">
        {resources.length === 0 && (
          <div className="card-floating p-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No learning resources yet. Click &quot;Add Resource&quot; to create one.
            </p>
          </div>
        )}

        {resources.map((resource) => (
          <div
            key={resource.id}
            className="card-floating p-4 flex items-center gap-4"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            <div className="flex items-center gap-2 flex-shrink-0">
              <TypeIcon type={resource.type} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground truncate">
                  {resource.title}
                </h3>
                <Badge
                  variant="secondary"
                  className={
                    resource.isPublished
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }
                >
                  {resource.isPublished ? "Published" : "Draft"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {resource.category}
                </Badge>
              </div>
              {resource.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {resource.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleTogglePublish(resource)}
                title={resource.isPublished ? "Unpublish" : "Publish"}
              >
                {resource.isPublished ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>

              {resource.isPublished && (
                <a
                  href={`/learn/${resource.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" title="View">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingResource(resource);
                  setShowForm(true);
                }}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(resource.id)}
                disabled={deleting === resource.id}
                title="Delete"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
