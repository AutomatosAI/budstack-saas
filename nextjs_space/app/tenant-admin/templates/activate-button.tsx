"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

interface ActivateButtonProps {
  templateId: string;
  templateName: string;
  isActive: boolean;
}

export default function ActivateButton({
  templateId,
  templateName,
  isActive,
}: ActivateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleActivate = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/tenant-admin/templates/${templateId}/activate`,
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to activate template");
      }

      toast.success(`${templateName} is now active`);
      router.refresh();
    } catch (error) {
      console.error("Activation error:", error);
      toast.error("Failed to activate template");
    } finally {
      setIsLoading(false);
    }
  };

  if (isActive) {
    return (
      <button
        type="button"
        className="bs-btn bs-btn-green bs-btn-sm"
        disabled
      >
        <Check className="mr-2 h-4 w-4" aria-hidden="true" />
        Active
      </button>
    );
  }

  return (
    <button
      type="button"
      className="bs-btn bs-btn-green bs-btn-sm"
      onClick={handleActivate}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Activating...
        </>
      ) : (
        "Activate"
      )}
    </button>
  );
}
