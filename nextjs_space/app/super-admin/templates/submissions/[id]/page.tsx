import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getJsonFromS3, getTextFromS3 } from "@/lib/storage/s3";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileCode2,
} from "lucide-react";
import { RowPill } from "@/components/admin/shared";
import ReviewActions from "./review-actions";
import EditApproveDialog from "./edit-approve-dialog";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function SubmissionReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
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

  const validationResults: { label: string; pass: boolean; detail?: string }[] =
    [];
  validationResults.push({
    label: "layout.json present",
    pass: layoutJson !== null,
  });
  validationResults.push({
    label: "defaults.json present",
    pass: defaultsJson !== null,
  });
  validationResults.push({
    label: "template.config.json present",
    pass: configJson !== null,
  });
  validationResults.push({
    label: "styles.css present",
    pass: stylesCss !== null,
  });

  if (configJson) {
    try {
      const config = JSON.parse(configJson);
      validationResults.push({ label: "Config has name", pass: !!config.name });
      validationResults.push({
        label: "Config has category",
        pass: !!config.category,
      });
    } catch {
      validationResults.push({ label: "Config is valid JSON", pass: false });
    }
  }

  const statusToneMap: Record<
    string,
    { label: string; tone: "amber" | "emerald" | "red" | "gold" | "slate" }
  > = {
    pending: { label: "Pending Review", tone: "amber" },
    approved: { label: "Approved", tone: "emerald" },
    rejected: { label: "Rejected", tone: "red" },
    changes_requested: { label: "Changes Requested", tone: "gold" },
    withdrawn: { label: "Withdrawn", tone: "slate" },
  };
  const sc = statusToneMap[submission.status] || {
    label: submission.status,
    tone: "slate" as const,
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <Link
        href="/super-admin/templates"
        className="inline-flex items-center text-sm text-bs-fg-muted hover:text-bs-fg"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
        Back to Templates
      </Link>

      <section className="bs-card bs-card-pad">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1
                className="text-[22px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                {submission.templateName}
              </h1>
              <RowPill tone={sc.tone}>{sc.label}</RowPill>
            </div>
            <p className="text-bs-fg-muted">
              By {submission.tenant.businessName}
            </p>
            {submission.description && (
              <p className="text-sm text-bs-fg-muted mt-2">
                {submission.description}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-bs-fg-muted">
            <p>
              Submitted {new Date(submission.createdAt).toLocaleDateString()}
            </p>
            {submission.category && <p>Category: {submission.category}</p>}
          </div>
        </div>
        {submission.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {submission.tags.map((tag: string) => (
              <RowPill key={tag} tone="blue">
                {tag}
              </RowPill>
            ))}
          </div>
        )}
        {submission.reviewerFeedback && (
          <div className="mt-4 p-3 bg-bs-warn/10 border border-bs-warn/30 rounded-bs-sm">
            <p className="text-sm font-medium text-bs-fg">Previous Feedback:</p>
            <p className="text-sm text-bs-fg-muted mt-1">
              {submission.reviewerFeedback}
            </p>
          </div>
        )}
      </section>

      <section className="bs-card bs-card-pad">
        <h2
          className="text-[22px] leading-tight text-bs-fg mb-4"
          style={sectionTitleStyle}
        >
          Validation Report
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {validationResults.map((v, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {v.pass ? (
                <CheckCircle2
                  className="h-4 w-4 text-bs-green"
                  aria-hidden="true"
                />
              ) : (
                <XCircle
                  className="h-4 w-4 text-bs-danger"
                  aria-hidden="true"
                />
              )}
              <span className={v.pass ? "text-bs-fg" : "text-bs-danger"}>
                {v.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bs-card bs-card-pad">
        <h2
          className="text-[22px] leading-tight text-bs-fg mb-4 flex items-center gap-2"
          style={sectionTitleStyle}
        >
          <FileCode2 className="h-5 w-5" aria-hidden="true" />
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
            <pre className="bg-bs-canvas border border-bs-border-100 text-bs-fg p-4 rounded-bs-md overflow-auto max-h-96 text-xs font-mono">
              <code>{layoutJson || "File not found"}</code>
            </pre>
          </TabsContent>
          <TabsContent value="defaults">
            <pre className="bg-bs-canvas border border-bs-border-100 text-bs-fg p-4 rounded-bs-md overflow-auto max-h-96 text-xs font-mono">
              <code>{defaultsJson || "File not found"}</code>
            </pre>
          </TabsContent>
          <TabsContent value="config">
            <pre className="bg-bs-canvas border border-bs-border-100 text-bs-fg p-4 rounded-bs-md overflow-auto max-h-96 text-xs font-mono">
              <code>{configJson || "File not found"}</code>
            </pre>
          </TabsContent>
          <TabsContent value="styles">
            <pre className="bg-bs-canvas border border-bs-border-100 text-bs-fg p-4 rounded-bs-md overflow-auto max-h-96 text-xs font-mono">
              <code>{stylesCss || "File not found"}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </section>

      <section className="bs-card bs-card-pad">
        <h2
          className="text-[22px] leading-tight text-bs-fg mb-4"
          style={sectionTitleStyle}
        >
          Review Actions
        </h2>
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
      </section>

      {Array.isArray(submission.reviewHistory) &&
        (submission.reviewHistory as any[]).length > 0 && (
          <section className="bs-card bs-card-pad">
            <h2
              className="text-[22px] leading-tight text-bs-fg mb-4"
              style={sectionTitleStyle}
            >
              Review History
            </h2>
            <div className="space-y-3">
              {(submission.reviewHistory as any[]).map(
                (entry: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <AlertCircle
                      className="h-4 w-4 mt-0.5 text-bs-fg-muted"
                      aria-hidden="true"
                    />
                    <div>
                      <span className="font-medium text-bs-fg">
                        {entry.action}
                      </span>
                      <span className="text-bs-fg-muted">
                        {" "}
                        by {entry.by} on{" "}
                        {new Date(entry.at).toLocaleDateString()}
                      </span>
                      {entry.feedback && (
                        <p className="text-bs-fg-muted mt-1 italic">
                          &ldquo;{entry.feedback}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        )}
    </div>
  );
}
