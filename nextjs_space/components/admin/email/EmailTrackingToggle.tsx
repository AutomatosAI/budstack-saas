"use client";

/**
 * US-027 — the per-store open/click tracking switch.
 *
 * Off until asked for, and the copy says what turning it on actually does
 * rather than selling the feature: it changes what the store records about
 * people who never asked to be measured, and it changes the store's own privacy
 * notice. An operator flipping this is making a data-protection decision, so
 * the consequences are on the screen next to the switch instead of in a doc.
 */

import { useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

import {
  EMAIL_SETTINGS_URL,
  readEmailTracking,
  saveEmailTracking,
} from "./email-settings-client";

const SAVE_FAILED_MESSAGE = "Could not change the tracking setting";

export function EmailTrackingToggle() {
  const { data, error, isLoading, mutate } = useSWR<boolean>(
    EMAIL_SETTINGS_URL,
    readEmailTracking,
  );
  const [saving, setSaving] = useState(false);

  const enabled = data === true;

  const toggle = async (next: boolean) => {
    setSaving(true);
    try {
      // Optimistic, then revalidated: the switch must not sit in the old
      // position while the request is in flight, and it must not stay in the
      // new one if the request is refused.
      await mutate(saveEmailTracking(next), {
        optimisticData: next,
        revalidate: true,
      });
      toast.success(
        next
          ? "Tracking on — new campaigns will measure opens and clicks"
          : "Tracking off — nothing further will be recorded",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : SAVE_FAILED_MESSAGE);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bs-card bs-card-pad space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="bs-eyebrow">Open and click tracking</p>
          <p className="text-sm text-bs-fg-muted">
            Off by default. When on, campaigns carry an invisible image that
            reports when a message is opened, and their links go through a
            redirect that records which were followed. Nobody&rsquo;s email
            address appears in either address.
          </p>
          <p className="text-sm text-bs-fg-muted">
            Turning this on adds a tracking clause to your published privacy
            notice. Turning it off stops all recording immediately, including
            for campaigns already in people&rsquo;s inboxes; campaigns saved
            while it was on keep their links until they are edited again.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {(saving || isLoading) && (
            <Loader2 className="h-4 w-4 animate-spin text-bs-fg-muted" />
          )}
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={saving || isLoading || Boolean(error)}
            aria-label="Open and click tracking"
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-bs-danger">
          {error instanceof Error ? error.message : SAVE_FAILED_MESSAGE}
        </p>
      )}
    </div>
  );
}
