import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadTemplateDialog } from "./upload-dialog";
import { TemplateActions } from "./template-actions";
import { Breadcrumbs } from "@/components/admin/shared";

export default async function TemplatesManagementPage() {
  const session = await getServerSession();

  if (!session?.user?.email) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
  });

  if (user?.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all templates
  const templates = await prisma.templates.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/super-admin" },
          { label: "Templates" },
        ]}
        className="mb-4"
      />

      {/* Page Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Template Management
          </h1>
          <p className="text-slate-600 mt-2">
            Manage home page templates for tenants
          </p>
        </div>
        <UploadTemplateDialog />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template: any) => (
          <Card
            key={template.id}
            className="shadow-lg border-slate-200 hover:shadow-xl transition-all duration-300 overflow-hidden group"
          >
            <CardHeader
              className={`border-b ${template.isActive ? "bg-gradient-to-r from-emerald-50 to-teal-50" : "bg-gradient-to-r from-slate-50 to-slate-100"}`}
            >
              <div className="flex justify-between items-start mb-3">
                <Badge
                  className={
                    template.isActive
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : "bg-slate-400"
                  }
                >
                  {template.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white border-slate-300 text-slate-700"
                >
                  {template.category}
                </Badge>
              </div>
              <CardTitle className="text-xl text-slate-900 group-hover:text-cyan-700 transition-colors">
                {template.name}
              </CardTitle>
              <CardDescription className="line-clamp-2 text-slate-600">
                {template.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                    <span className="text-slate-600">v{template.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="text-slate-600">
                      {template.usageCount} tenant(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-slate-600">
                      {template.author || "BudStack"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-slate-600">
                      {template.downloadCount} downloads
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {template.tags.slice(0, 4).map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs bg-blue-50 border-blue-200 text-blue-700"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full hover:bg-slate-50"
                    disabled
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <TemplateActions
                    templateId={template.id}
                    templateName={template.name}
                    usageCount={template.usageCount}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No templates found. Upload your first template to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="mt-8 shadow-lg border-slate-200">
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardTitle className="text-lg text-slate-900">
            Template System Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
              <span>
                Templates are stored in{" "}
                <code className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">
                  /templates
                </code>{" "}
                directory
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
              <span>
                Each template consists of index.tsx, components/, styles.css,
                template.config.json, and defaults.json
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
              <span>
                Templates automatically inherit tenant branding (colors, fonts,
                images)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
              <span>
                Upload templates directly from GitHub repositories using the
                "Upload New Template" button
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
              <span>
                Templates can be deleted if they are not currently in use by any
                tenant
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
              <span>
                See TEMPLATE_DESIGN_GUIDE.md for template creation guidelines
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
