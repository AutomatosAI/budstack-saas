"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { TAG_MAX_LENGTH, normalizeTag } from "@/lib/customers/tag-format";

interface CustomerTagsProps {
  customerId: string;
  initialTags: string[];
}

/** Pull the API's safe error message out of a failed response, if any. */
async function errorMessageOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * US-024 — tag chips with add/remove on the customer detail page. The server
 * responds to every mutation with the customer's full, alphabetised tag list,
 * so local state is always replaced wholesale rather than patched — add and
 * remove cannot drift from what is stored.
 */
export default function CustomerTags({ customerId, initialTags }: CustomerTagsProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const addTag = async () => {
    const tag = normalizeTag(draft);
    if (!tag || isBusy) return;

    setIsBusy(true);
    try {
      const res = await fetch(`/api/tenant-admin/customers/${customerId}/tags`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) {
        toast.error(await errorMessageOf(res, "Failed to add tag"));
        return;
      }
      const body = (await res.json()) as { tags: string[] };
      setTags(body.tags);
      setDraft("");
    } catch {
      toast.error("Failed to add tag");
    } finally {
      setIsBusy(false);
    }
  };

  const removeTag = async (tag: string) => {
    if (isBusy) return;

    setIsBusy(true);
    try {
      const res = await fetch(
        `/api/tenant-admin/customers/${customerId}/tags?tag=${encodeURIComponent(tag)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error(await errorMessageOf(res, "Failed to remove tag"));
        return;
      }
      const body = (await res.json()) as { tags: string[] };
      setTags(body.tags);
    } catch {
      toast.error("Failed to remove tag");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {tags.length === 0 ? (
        <p className="text-sm text-bs-fg-muted">
          No tags yet. Tag this customer to target them in campaigns.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="bs-chip bs-chip-green inline-flex items-center gap-1.5">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={isBusy}
                  aria-label={`Remove tag ${tag}`}
                  className="rounded-full hover:opacity-70 transition-opacity disabled:opacity-40"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void addTag();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={TAG_MAX_LENGTH}
          placeholder="Add a tag..."
          aria-label="Add a tag"
          disabled={isBusy}
          className="bs-input w-full"
        />
        <button
          type="submit"
          disabled={isBusy || !normalizeTag(draft)}
          className="bs-btn bs-btn-ghost bs-btn-sm gap-1.5 shrink-0 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </form>
    </div>
  );
}
