"use client";

import { useState } from "react";
import { Copy, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

interface TemplateCloneButtonProps {
  templateId: string;
  templateName: string;
}

export default function TemplateCloneButton({
  templateId,
  templateName,
}: TemplateCloneButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleClone = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/tenant-admin/templates/clone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ baseTemplateId: templateId }),
      });

      if (!response.ok) {
        throw new Error("Failed to clone template");
      }

      setIsSuccess(true);
      router.refresh();

      setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Clone error:", error);
      toast.error("Failed to clone template. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`bs-btn ${isSuccess ? "bs-btn-ghost" : "bs-btn-green"} w-full`}
      onClick={handleClone}
      disabled={isLoading || isSuccess}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Cloning...
        </>
      ) : isSuccess ? (
        <>
          <Check className="mr-2 h-4 w-4 text-bs-green" aria-hidden="true" />
          Cloned!
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Clone Template
        </>
      )}
    </button>
  );
}
