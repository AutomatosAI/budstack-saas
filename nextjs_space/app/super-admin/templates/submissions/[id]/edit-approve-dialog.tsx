"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

interface EditApproveDialogProps {
  submissionId: string;
  status: string;
  layoutJson: string | null;
  defaultsJson: string | null;
  configJson: string | null;
  stylesCss: string | null;
}

export default function EditApproveDialog({
  submissionId,
  status,
  layoutJson,
  defaultsJson,
  configJson,
  stylesCss,
}: EditApproveDialogProps) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState(layoutJson || "");
  const [defaults, setDefaults] = useState(defaultsJson || "");
  const [config, setConfig] = useState(configJson || "");
  const [styles, setStyles] = useState(stylesCss || "");
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const isDisabled = status === "approved" || status === "rejected" || status === "withdrawn";

  const handleEditAndApprove = async () => {
    setIsProcessing(true);
    try {
      // Save edits
      const editRes = await fetch(`/api/super-admin/submissions/${submissionId}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layoutJson: layout,
          defaultsJson: defaults,
          configJson: config,
          stylesCss: styles,
        }),
      });

      if (!editRes.ok) {
        const data = await editRes.json();
        throw new Error(data.error || "Failed to save edits");
      }

      // Approve
      const approveRes = await fetch(`/api/super-admin/submissions/${submissionId}/approve`, {
        method: "POST",
      });

      if (!approveRes.ok) {
        const data = await approveRes.json();
        throw new Error(data.error || "Failed to approve");
      }

      toast.success("Template edited and approved");
      setOpen(false);
      router.push("/super-admin/templates?tab=submissions");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to edit and approve");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={isDisabled}
          className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit & Approve
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template Files & Approve</DialogTitle>
          <DialogDescription>
            Make changes to the template files before approving. All changes will be saved to the marketplace version.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="layout" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="layout">layout.json</TabsTrigger>
            <TabsTrigger value="defaults">defaults.json</TabsTrigger>
            <TabsTrigger value="config">template.config.json</TabsTrigger>
            <TabsTrigger value="styles">styles.css</TabsTrigger>
          </TabsList>
          <TabsContent value="layout">
            <Textarea
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
              className="font-mono text-xs min-h-[400px]"
              disabled={isProcessing}
            />
          </TabsContent>
          <TabsContent value="defaults">
            <Textarea
              value={defaults}
              onChange={(e) => setDefaults(e.target.value)}
              className="font-mono text-xs min-h-[400px]"
              disabled={isProcessing}
            />
          </TabsContent>
          <TabsContent value="config">
            <Textarea
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              className="font-mono text-xs min-h-[400px]"
              disabled={isProcessing}
            />
          </TabsContent>
          <TabsContent value="styles">
            <Textarea
              value={styles}
              onChange={(e) => setStyles(e.target.value)}
              className="font-mono text-xs min-h-[400px]"
              disabled={isProcessing}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isProcessing}
            className="rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditAndApprove}
            disabled={isProcessing}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Save & Approve"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
