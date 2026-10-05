"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";

/**
 * Registration Redirect
 *
 * All customer signups must go through the consultation form for KYC compliance.
 * This page redirects to the consultation page, query string included.
 */
export default function RegisterRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  useEffect(() => {
    if (slug) {
      const basePath = getTenantBasePath(slug);
      // BS-A01: keep the query string so a holder's /register?ref=CODE link
      // still pre-fills the referral code. Read from window.location (this
      // effect only runs in the browser) rather than useSearchParams, which
      // would need a Suspense boundary around this page.
      router.replace(`${basePath}/consultation${window.location.search}`);
    }
  }, [slug, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to eligibility check...</p>
      </div>
    </div>
  );
}
