"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/tenant-admin/products/sync", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast.success(
        `Synced ${data.total} products (${data.created} new, ${data.updated} updated)`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="bs-btn bs-btn-green disabled:opacity-50"
    >
      <RefreshCw
        className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {syncing ? "Syncing..." : "Sync from Dr Green"}
    </button>
  );
}
