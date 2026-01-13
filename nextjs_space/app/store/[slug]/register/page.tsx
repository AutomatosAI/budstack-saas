"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Registration Redirect
 *
 * All customer signups must go through the consultation form for KYC compliance.
 * This page redirects to the consultation page.
 */
export default function RegisterRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  useEffect(() => {
    if (slug) {
      // Redirect to consultation page
      router.replace(`/store/${slug}/consultation`);
    }
  }, [slug, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to eligibility check...</p>
      </div>
    </div>
  );
}
