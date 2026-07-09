"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Member {
  id: string;
  email: string;
  name: string | null;
  teamRole: string | null;
  isActive: boolean;
  isSelf: boolean;
}
interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}
interface TeamClientProps {
  members: Member[];
  invitations: Invitation[];
  canRemove: boolean;
  canManageRoles: boolean;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "customer_support", label: "Customer Support" },
  { value: "web_designer", label: "Web Designer" },
  { value: "manager", label: "Manager" },
];
const roleLabel = (r: string | null) =>
  ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r ?? "—";

export function TeamClient({
  members,
  invitations,
  canRemove,
  canManageRoles,
}: TeamClientProps) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/tenant-admin/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to send invitation");
      toast.success(`Invitation sent to ${email}`);
      setInviteOpen(false);
      setEmail("");
      setRole("editor");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send invitation");
    } finally {
      setBusy(false);
    }
  }

  async function callAction(url: string, method: string, successMsg: string, id: string) {
    setPendingId(id);
    try {
      const res = await fetch(url, { method });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Something went wrong");
      toast.success(successMsg);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong");
    } finally {
      setPendingId(null);
    }
  }

  function removeMember(id: string) {
    if (!confirm("Remove this team member? They'll lose access immediately.")) return;
    void callAction(`/api/tenant-admin/team/members/${id}`, "DELETE", "Team member removed", id);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="bs-page-title">Team</h1>
          <p className="bs-page-subtitle">
            Invite teammates and manage what they can access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageRoles && (
            <Link href="/tenant-admin/team/roles">
              <Button variant="outline" size="sm">
                <ShieldCheck className="w-4 h-4 mr-2" /> Manage roles
              </Button>
            </Link>
          )}
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Invite member
          </Button>
        </div>
      </header>

      <section className="bs-card">
        <div className="bs-card-pad">
          <h2 className="bs-eyebrow mb-4">Members ({members.length})</h2>
          <div className="overflow-x-auto">
            <table className="bs-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Role</th>
                  <th className="text-left">Status</th>
                  {canRemove && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.name || "—"}
                      {m.isSelf && <span className="text-bs-fg-muted"> (you)</span>}
                    </td>
                    <td>{m.email}</td>
                    <td>{roleLabel(m.teamRole)}</td>
                    <td>{m.isActive ? "Active" : "Inactive"}</td>
                    {canRemove && (
                      <td className="text-right">
                        {!m.isSelf && m.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendingId === m.id}
                            onClick={() => removeMember(m.id)}
                          >
                            {pendingId === m.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Remove"
                            )}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {invitations.length > 0 && (
        <section className="bs-card">
          <div className="bs-card-pad">
            <h2 className="bs-eyebrow mb-4">
              Pending invitations ({invitations.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="bs-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Email</th>
                    <th className="text-left">Role</th>
                    <th className="text-left">Expires</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.email}</td>
                      <td>{roleLabel(inv.role)}</td>
                      <td>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                      <td className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === inv.id}
                          onClick={() =>
                            callAction(
                              `/api/tenant-admin/team/invitations/${inv.id}/resend`,
                              "POST",
                              "Invitation resent",
                              inv.id,
                            )
                          }
                        >
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === inv.id}
                          onClick={() =>
                            callAction(
                              `/api/tenant-admin/team/invitations/${inv.id}`,
                              "DELETE",
                              "Invitation revoked",
                              inv.id,
                            )
                          }
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
            <DialogDescription>
              They&apos;ll get an email invitation to join your team.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setInviteOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
