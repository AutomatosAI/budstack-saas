"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Loader2,
} from "lucide-react";
import { RowPill } from "@/components/admin/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
        <div className="p-3 bg-bs-danger/10 border border-bs-danger/30 text-bs-danger rounded-bs-sm text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title" className="text-bs-fg">
            Title
          </Label>
          <Input
            id="title"
            name="title"
            defaultValue={resource?.title}
            required
            placeholder="How to customize your template"
          />
        </div>

        <div>
          <Label htmlFor="category" className="text-bs-fg">
            Category
          </Label>
          <Select
            name="category"
            defaultValue={resource?.category || "general"}
          >
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
          <Label htmlFor="type" className="text-bs-fg">
            Type
          </Label>
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
        <Label htmlFor="description" className="text-bs-fg">
          Short Description
        </Label>
        <Input
          id="description"
          name="description"
          defaultValue={resource?.description || ""}
          placeholder="A brief summary shown on the card"
        />
      </div>

      <div>
        <Label htmlFor="content" className="text-bs-fg">
          Content (Markdown)
        </Label>
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
          <Label htmlFor="videoUrl" className="text-bs-fg">
            Video URL (YouTube/Vimeo)
          </Label>
          <Input
            id="videoUrl"
            name="videoUrl"
            defaultValue={resource?.videoUrl || ""}
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>

        <div>
          <Label htmlFor="docUrl" className="text-bs-fg">
            External Doc URL
          </Label>
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
          <Label htmlFor="coverImage" className="text-bs-fg">
            Cover Image
          </Label>
          <Input
            id="coverImage"
            name="coverImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </div>

        <div>
          <Label htmlFor="docFile" className="text-bs-fg">
            Upload Document (PDF)
          </Label>
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
          <Label htmlFor="tags" className="text-bs-fg">
            Tags (comma-separated)
          </Label>
          <Input
            id="tags"
            name="tags"
            defaultValue={resource?.tags?.join(", ") || ""}
            placeholder="setup, beginner, customization"
          />
        </div>

        <div>
          <Label htmlFor="sortOrder" className="text-bs-fg">
            Sort Order
          </Label>
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
        <Label htmlFor="isPublished" className="cursor-pointer text-bs-fg">
          Published (visible on public site)
        </Label>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="bs-btn bs-btn-ghost"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="bs-btn bs-btn-green"
        >
          {loading ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Saving...
            </>
          ) : resource ? (
            "Update Resource"
          ) : (
            "Create Resource"
          )}
        </button>
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
    fetch("/api/super-admin/learning")
      .then((r) => r.json())
      .then((data) => setResources(data.resources))
      .catch(() => {});
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
    } catch {
      // swallow — UI shows no row removed if call failed
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
    } catch {
      // swallow — UI state unchanged on error
    }
  };

  const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "video":
        return (
          <Play className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
        );
      case "guide":
        return (
          <FileText className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
        );
      default:
        return (
          <BookOpen className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
        );
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-bs-fg-muted">
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
            <button
              type="button"
              onClick={() => setEditingResource(undefined)}
              className="bs-btn bs-btn-green gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Resource
            </button>
          </DialogTrigger>
          <DialogContent className="bs-dialog-content max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className="text-[22px] leading-tight"
                style={sectionTitleStyle}
              >
                {editingResource ? "Edit Resource" : "New Resource"}
              </DialogTitle>
              <DialogDescription className="text-bs-fg-muted">
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

      <div className="space-y-3">
        {resources.length === 0 && (
          <div className="bs-card bs-card-pad text-center py-12">
            <BookOpen
              className="h-8 w-8 text-bs-fg-muted mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-bs-fg-muted">
              No learning resources yet. Click &quot;Add Resource&quot; to
              create one.
            </p>
          </div>
        )}

        {resources.map((resource) => (
          <div
            key={resource.id}
            className="bs-card bs-card-pad p-4 flex items-center gap-4"
          >
            <GripVertical
              className="h-4 w-4 text-bs-fg-muted flex-shrink-0"
              aria-hidden="true"
            />

            <div className="flex items-center gap-2 flex-shrink-0">
              <TypeIcon type={resource.type} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-bs-fg truncate">
                  {resource.title}
                </h3>
                <RowPill tone={resource.isPublished ? "emerald" : "slate"}>
                  {resource.isPublished ? "Published" : "Draft"}
                </RowPill>
                <RowPill tone="blue">{resource.category}</RowPill>
              </div>
              {resource.description && (
                <p className="text-sm text-bs-fg-muted truncate mt-0.5">
                  {resource.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleTogglePublish(resource)}
                title={resource.isPublished ? "Unpublish" : "Publish"}
                aria-label={resource.isPublished ? "Unpublish" : "Publish"}
                className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
              >
                {resource.isPublished ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {resource.isPublished && (
                <a
                  href={`/learn/${resource.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View"
                  aria-label="View resource"
                  className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingResource(resource);
                  setShowForm(true);
                }}
                title="Edit"
                aria-label="Edit resource"
                className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(resource.id)}
                disabled={deleting === resource.id}
                title="Delete"
                aria-label="Delete resource"
                className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0 text-bs-danger hover:text-bs-danger"
              >
                {deleting === resource.id ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
