"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

      toast.success(`✅ ${templateName} is now active!`);
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
      <Button
        size="sm"
        variant="default"
        className="bg-green-600 hover:bg-green-700"
        disabled
      >
        <Check className="mr-2 h-4 w-4" />
        Active
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="default"
      onClick={handleActivate}
      disabled={isLoading}
      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Activating...
        </>
      ) : (
        "Activate"
      )}
    </Button>
  );
}
