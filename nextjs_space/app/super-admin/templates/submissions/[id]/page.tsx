import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getJsonFromS3, getTextFromS3 } from "@/lib/s3";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, FileCode2 } from "lucide-react";
import ReviewActions from "./review-actions";
import EditApproveDialog from "./edit-approve-dialog";

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/sign-in");
  }

  const { id } = await params;

  const submission = await prisma.marketplace_submissions.findUnique({
    where: { id },
    include: {
      tenant: { select: { businessName: true } },
      tenantTemplate: { select: { templateName: true, s3Path: true } },
      reviewer: { select: { name: true, email: true } },
    },
  });

  if (!submission) {
    redirect("/super-admin/templates");
  }

  // Read template files from staging S3
  const stagingPath = submission.stagingS3Path;
  let layoutJson: string | null = null;
  let defaultsJson: string | null = null;
  let configJson: string | null = null;
  let stylesCss: string | null = null;

  try {
    const data = await getJsonFromS3(`${stagingPath}layout.json`);
    layoutJson = JSON.stringify(data, null, 2);
  } catch {
    layoutJson = null;
  }
  try {
    const data = await getJsonFromS3(`${stagingPath}defaults.json`);
    defaultsJson = JSON.stringify(data, null, 2);
  } catch {
    defaultsJson = null;
  }
  try {
    const data = await getJsonFromS3(`${stagingPath}template.config.json`);
    configJson = JSON.stringify(data, null, 2);
  } catch {
    configJson = null;
  }
  try {
    stylesCss = await getTextFromS3(`${stagingPath}styles.css`);
  } catch {
    stylesCss = null;
  }

  // Validation checks
  const validationResults: { label: string; pass: boolean; detail?: string }[] = [];
  validationResults.push({ label: "layout.json present", pass: layoutJson !== null });
  validationResults.push({ label: "defaults.json present", pass: defaultsJson !== null });
  validationResults.push({ label: "template.config.json present", pass: configJson !== null });
  validationResults.push({ label: "styles.css present", pass: stylesCss !== null });

  if (configJson) {
    try {
      const config = JSON.parse(configJson);
      validationResults.push({ label: "Config has name", pass: !!config.name });
      validationResults.push({ label: "Config has category", pass: !!config.category });
    } catch {
      validationResults.push({ label: "Config is valid JSON", pass: false });
    }
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending Review", className: "bg-yellow-500" },
    approved: { label: "Approved", className: "bg-green-500" },
    rejected: { label: "Rejected", className: "bg-red-500" },
    changes_requested: { label: "Changes Requested", className: "bg-orange-500" },
    withdrawn: { label: "Withdrawn", className: "bg-slate-400" },
  };
  const sc = statusConfig[submission.status] || { label: submission.status, className: "bg-slate-400" };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back Link */}
      <Link href="/super-admin/templates" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Templates
      </Link>

      {/* Header */}
      <div className="card-floating p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl font-bold text-foreground">
                {submission.templateName}
              </h1>
              <Badge className={`${sc.className} border-none`}>
                {sc.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              By {submission.tenant.businessName}
            </p>
            {submission.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {submission.description}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Submitted {new Date(submission.createdAt).toLocaleDateString()}</p>
            {submission.category && <p>Category: {submission.category}</p>}
          </div>
        </div>
        {submission.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {submission.tags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-xs bg-blue-50 border-blue-200 text-blue-700">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {submission.reviewerFeedback && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-800">Previous Feedback:</p>
            <p className="text-sm text-orange-700 mt-1">{submission.reviewerFeedback}</p>
          </div>
        )}
      </div>

      {/* Validation Report */}
      <div className="card-floating p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Validation Report</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {validationResults.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {v.pass ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={v.pass ? "text-foreground" : "text-red-600"}>
                {v.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* File Viewer */}
      <div className="card-floating p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          <FileCode2 className="inline-block h-5 w-5 mr-2" />
          Template Files
        </h2>
        <Tabs defaultValue="layout" className="w-full">
          <TabsList>
            <TabsTrigger value="layout">layout.json</TabsTrigger>
            <TabsTrigger value="defaults">defaults.json</TabsTrigger>
            <TabsTrigger value="config">template.config.json</TabsTrigger>
            <TabsTrigger value="styles">styles.css</TabsTrigger>
          </TabsList>
          <TabsContent value="layout">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96 text-xs font-mono">
              <code>{layoutJson || "File not found"}</code>
            </pre>
          </TabsContent>
          <TabsContent value="defaults">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96 text-xs font-mono">
              <code>{defaultsJson || "File not found"}</code>
            </pre>
          </TabsContent>
          <TabsContent value="config">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96 text-xs font-mono">
              <code>{configJson || "File not found"}</code>
            </pre>
          </TabsContent>
          <TabsContent value="styles">
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-96 text-xs font-mono">
              <code>{stylesCss || "File not found"}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Actions */}
      <div className="card-floating p-6">
        <h2 className="font-display text-lg font-bold text-foreground mb-4">Review Actions</h2>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <ReviewActions submissionId={id} status={submission.status} />
          </div>
          <EditApproveDialog
            submissionId={id}
            status={submission.status}
            layoutJson={layoutJson}
            defaultsJson={defaultsJson}
            configJson={configJson}
            stylesCss={stylesCss}
          />
        </div>
      </div>

      {/* Review History */}
      {Array.isArray(submission.reviewHistory) && (submission.reviewHistory as any[]).length > 0 && (
        <div className="card-floating p-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Review History</h2>
          <div className="space-y-3">
            {(submission.reviewHistory as any[]).map((entry: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-muted-foreground">
                    {" "}by {entry.by} on {new Date(entry.at).toLocaleDateString()}
                  </span>
                  {entry.feedback && (
                    <p className="text-muted-foreground mt-1 italic">&ldquo;{entry.feedback}&rdquo;</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
