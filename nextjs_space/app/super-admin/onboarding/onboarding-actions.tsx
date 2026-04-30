"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";

export default function OnboardingActions({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const approveTenant = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });

      if (!res.ok) throw new Error("Failed to approve tenant");

      toast.success("Tenant approved successfully");
      router.refresh();
    } catch {
      toast.error("Failed to approve tenant");
    } finally {
      setIsLoading(false);
    }
  };

  const rejectTenant = async () => {
    if (
      !confirm(
        "Are you sure you want to reject this tenant? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to reject tenant");

      toast.success("Tenant rejected");
      router.refresh();
    } catch {
      toast.error("Failed to reject tenant");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={approveTenant}
        disabled={isLoading}
        className="bs-btn bs-btn-green bs-btn-sm"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          "Approve"
        )}
      </button>
      <button
        type="button"
        onClick={rejectTenant}
        disabled={isLoading}
        className="bs-btn bs-btn-danger bs-btn-sm"
      >
        Reject
      </button>
    </div>
  );
}
