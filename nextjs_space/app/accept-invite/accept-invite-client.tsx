"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser, SignUp } from "@clerk/nextjs";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

interface Preview {
  tenantName: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  customer_support: "Customer Support",
  web_designer: "Web Designer",
  manager: "Manager",
};

export function AcceptInviteClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const { isLoaded, isSignedIn } = useUser();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("This invitation link is missing its token.");
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/team/invitation?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setLoadError(payload?.error || "This invitation is invalid or has expired.");
        } else {
          setPreview(payload.invitation);
        }
      })
      .catch(() => active && setLoadError("Could not load this invitation."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function accept() {
    setAccepting(true);
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Failed to accept invitation");
      toast.success("Welcome to the team!");
      router.push(payload.redirectTo || "/tenant-admin");
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept invitation");
      setAccepting(false);
    }
  }

  const acceptPath = `/accept-invite?token=${encodeURIComponent(token)}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bs-bg">
      <div className="max-w-md w-full">
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center border rounded-lg p-8 bg-white">
            <h1 className="text-xl font-semibold mb-2">Invitation unavailable</h1>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
        ) : preview ? (
          <div className="border rounded-lg p-8 bg-white space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold">Join {preview.tenantName}</h1>
              <p className="text-sm text-muted-foreground">
                You&apos;ve been invited to join <strong>{preview.tenantName}</strong> as a{" "}
                <strong>{ROLE_LABELS[preview.role] ?? preview.role}</strong>.
              </p>
            </div>

            {!isLoaded ? (
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : isSignedIn ? (
              <Button className="w-full" onClick={accept} disabled={accepting}>
                {accepting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Accept invitation
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  Sign in or create your account with <strong>{preview.email}</strong> to accept.
                </p>
                <div className="flex justify-center">
                  <SignUp
                    routing="hash"
                    forceRedirectUrl={acceptPath}
                    initialValues={{ emailAddress: preview.email }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
