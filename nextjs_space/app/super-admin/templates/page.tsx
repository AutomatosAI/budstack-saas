import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Eye, Layout } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { UploadTemplateDialog } from './upload-dialog';
import { TemplateActions } from './template-actions';

export default async function TemplatesManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'SUPER_ADMIN') {
    redirect('/auth/login');
  }

  // Fetch all templates
  const templates = await prisma.templates.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Layout className="h-4 w-4" />
          Templates
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Store Templates
        </h1>
        <p className="mt-3 text-muted-foreground">
          Manage home page templates for tenants. Templates define the visual layout of each store.
        </p>
        <div className="mt-6">
          <UploadTemplateDialog />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template: any) => (
          <div
            key={template.id}
            className="card-floating overflow-hidden group"
          >
            <div className="border-b border-slate-100 p-5">
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
              <h3 className="font-display text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {template.description}
              </p>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                    <span className="text-muted-foreground">v{template.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="text-muted-foreground">
                      {template.usageCount} tenant(s)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-muted-foreground">
                      {template.author || "BudStack"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-muted-foreground">
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
                    className="w-full rounded-xl"
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
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="card-floating p-12 text-center">
          <div className="icon-badge mx-auto mb-4">
            <Layout className="h-6 w-6 text-white" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground mb-2">
            No Templates Found
          </h3>
          <p className="text-muted-foreground">
            Upload your first template to get started.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="card-floating p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="rounded-2xl bg-slate-500 p-3">
            <Layout className="h-5 w-5 text-white" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Template System Information
          </h2>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Templates are stored in{" "}
              <code className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">
                /templates
              </code>{" "}
              directory
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Each template consists of index.tsx, components/, styles.css,
              template.config.json, and defaults.json
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Templates automatically inherit tenant branding (colors, fonts,
              images)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Upload templates directly from GitHub repositories using the
              &quot;Upload New Template&quot; button
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              Templates can be deleted if they are not currently in use by any
              tenant
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2"></div>
            <span>
              See TEMPLATE_DESIGN_GUIDE.md for template creation guidelines
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
