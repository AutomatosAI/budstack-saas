"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

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

      // Reset success state after 2s
      setTimeout(() => {
        setIsSuccess(false);
        // Switch tab to "my-templates"? Ideally yes, but router.refresh() keeps current tab.
        // We could use query param or context to switch tab.
      }, 2000);
    } catch (error) {
      console.error("Clone error:", error);
      alert("Failed to clone template. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      className="w-full"
      onClick={handleClone}
      disabled={isLoading || isSuccess}
      variant={isSuccess ? "outline" : "default"}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cloning...
        </>
      ) : isSuccess ? (
        <>
          <Check className="mr-2 h-4 w-4 text-green-500" />
          Cloned!
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          Clone Template
        </>
      )}
    </Button>
  );
}
