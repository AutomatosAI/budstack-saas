"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions/permission-keys";

interface RoleData {
  role: string;
  editable: boolean;
  permissions: Record<string, boolean>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  customer_support: "Customer Support",
  web_designer: "Web Designer",
  manager: "Manager",
};

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  canViewCustomers: "View customers",
  canEditCustomers: "Edit customers",
  canExportCustomers: "Export customers",
  canDeleteCustomer: "Delete customers",
  canViewOrders: "View orders",
  canEditOrders: "Edit orders",
  canViewProducts: "View products",
  canEditProducts: "Edit products",
  canDeleteProducts: "Delete products",
  canViewAnalytics: "View analytics",
  canEditSettings: "Edit settings",
  canManageBranding: "Manage branding",
  canInviteTeamMembers: "Invite team members",
  canDeleteTeamMembers: "Remove team members",
  canViewAuditLogs: "View audit logs",
  canViewCRM: "View CRM",
  canViewEmails: "View emails",
  canEditEmails: "Edit emails",
  canViewTemplates: "View templates",
  canEditTemplates: "Edit templates",
  canViewSeo: "View SEO",
  canEditSeo: "Edit SEO",
};

export function RolesClient({ roles }: { roles: RoleData[] }) {
  const router = useRouter();
  const initial = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.role, { ...r.permissions }])),
    [roles],
  );
  const [matrix, setMatrix] =
    useState<Record<string, Record<string, boolean>>>(initial);
  const [saving, setSaving] = useState(false);

  const editableRoles = roles.filter((r) => r.editable).map((r) => r.role);

  function toggle(role: string, key: string, value: boolean) {
    setMatrix((prev) => ({ ...prev, [role]: { ...prev[role], [key]: value } }));
  }

  const dirtyRoles = editableRoles.filter((role) =>
    PERMISSION_KEYS.some((k) => matrix[role]?.[k] !== initial[role]?.[k]),
  );

  async function save() {
    setSaving(true);
    try {
      for (const role of dirtyRoles) {
        const res = await fetch(`/api/tenant-admin/team/roles/${role}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: matrix[role] }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || `Failed to save ${role}`);
      }
      toast.success("Role permissions saved");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="bs-page-title">Roles &amp; permissions</h1>
          <p className="bs-page-subtitle">
            Customize what each role can do. The Admin role always has full access.
          </p>
        </div>
        <Button size="sm" disabled={saving || dirtyRoles.length === 0} onClick={save}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save changes{dirtyRoles.length > 0 ? ` (${dirtyRoles.length})` : ""}
        </Button>
      </header>

      <section className="bs-card">
        <div className="bs-card-pad overflow-x-auto">
          <table className="bs-table w-full">
            <thead>
              <tr>
                <th className="text-left">Permission</th>
                {roles.map((r) => (
                  <th key={r.role} className="text-center">
                    {ROLE_LABELS[r.role] ?? r.role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map((key) => (
                <tr key={key}>
                  <td className="text-left">{PERMISSION_LABELS[key]}</td>
                  {roles.map((r) => (
                    <td key={r.role} className="text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={!!matrix[r.role]?.[key]}
                          disabled={!r.editable}
                          onCheckedChange={(v) => toggle(r.role, key, v)}
                          aria-label={`${ROLE_LABELS[r.role] ?? r.role}: ${PERMISSION_LABELS[key]}`}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
