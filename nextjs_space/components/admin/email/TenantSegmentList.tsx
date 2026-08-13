"use client";

/**
 * US-025 — the Segments tab.
 *
 * A segment is a RULE, so this list shows the rule in words and never a
 * recipient count: the count is live and belongs to the moment it is asked for,
 * which is inside the builder and inside the campaign audience picker. A number
 * cached in a table would be a promise about a list that changes hourly.
 */

import { useState } from "react";
import { format } from "date-fns";
import useSWR from "swr";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import {
  describeSegmentFilter,
  type SegmentSummary,
} from "@/lib/email/segment-filter";

import { SegmentBuilder, type SegmentDraft } from "./SegmentBuilder";
import {
  SEGMENTS_URL,
  deleteSegment,
  readySegmentFilter,
  saveSegment,
} from "./segment-client";

const UNREADABLE_RULE =
  "This rule was written by a newer version and can't be shown here.";

const fetcher = async (url: string): Promise<SegmentSummary[]> => {
  const res = await fetch(url);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Failed to fetch (${res.status})`);
  }
  return payload?.segments ?? [];
};

/** `null` closes the builder; `"new"` opens an empty one. */
type Editing = SegmentSummary | "new" | null;

export function TenantSegmentList() {
  const { data, error, isLoading, mutate } = useSWR<SegmentSummary[]>(
    SEGMENTS_URL,
    fetcher,
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const save = async ({ name, criteria }: SegmentDraft) => {
    const filter = readySegmentFilter(criteria);
    // The builder disables its own save until this is readable; the check here
    // is what makes that a guarantee rather than a convention.
    if (!filter) return;

    setIsSaving(true);
    try {
      await saveSegment({
        id: editing !== "new" && editing ? editing.id : undefined,
        name,
        filter,
      });
      toast.success(editing === "new" ? "Segment created" : "Segment saved");
      setEditing(null);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save segment");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (segment: SegmentSummary) => {
    if (!confirm(`Delete the segment "${segment.name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(segment.id);
    try {
      await deleteSegment(segment.id);
      toast.success("Segment deleted");
      mutate();
    } catch (err) {
      // Includes the 409 naming the campaigns still pointing at it, which is
      // the one message an author actually needs here.
      toast.error(err instanceof Error ? err.message : "Failed to delete segment");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bs-card bs-card-pad flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-bs-fg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bs-card bs-card-pad text-sm text-bs-danger">
        Failed to load segments.
      </div>
    );
  }

  const segments = data ?? [];

  return (
    <div className="bs-card bs-card-pad space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          disabled={editing !== null}
          className="bs-btn bs-btn-green bs-btn-sm"
        >
          <Plus className="h-4 w-4" /> <span>New Segment</span>
        </button>
      </div>

      {editing !== null && (
        <SegmentBuilder
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
          isSaving={isSaving}
        />
      )}

      {segments.length === 0 && editing === null ? (
        <p className="py-12 text-center text-sm text-bs-fg-muted">
          No segments yet. Save an audience rule — &ldquo;has not ordered in 60
          days&rdquo; — and point a campaign at it.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="bs-table w-full">
            <thead>
              <tr>
                <th className="text-left">Segment</th>
                <th className="hidden text-left md:table-cell">Last Updated</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <tr key={segment.id}>
                  <td className="font-medium text-bs-fg">
                    {segment.name}
                    <div className="max-w-[220px] truncate text-xs text-bs-fg-muted sm:max-w-[420px]">
                      {segment.filter
                        ? describeSegmentFilter(segment.filter)
                        : UNREADABLE_RULE}
                    </div>
                  </td>
                  <td className="hidden font-mono text-bs-fg-muted tabular-nums md:table-cell">
                    {format(new Date(segment.updatedAt), "MMM d, yyyy")}
                  </td>
                  <td className="text-right">
                    <div className="flex min-w-[80px] flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditing(segment)}
                        // A rule this build cannot read must not be opened in a
                        // builder that would save back a different one.
                        disabled={editing !== null || segment.filter === null}
                        title={segment.filter ? "Edit segment" : UNREADABLE_RULE}
                        className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(segment)}
                        disabled={deletingId === segment.id}
                        title="Delete segment"
                        className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0 text-bs-danger hover:text-bs-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
