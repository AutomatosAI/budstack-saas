"use client";

import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

interface TenantLoginFormProps {
  businessName: string;
  logoUrl: string | null;
  basePath: string;
}

function LoginFormInner({ businessName, logoUrl, basePath }: TenantLoginFormProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center">
        {/* Tenant branding above Clerk form */}
        {logoUrl && (
          <img
            src={logoUrl}
            alt={businessName}
            className="h-16 w-auto mb-4"
          />
        )}
        <h1 className="text-2xl font-bold mb-1">Sign in to {businessName}</h1>
        <p className="text-gray-500 text-sm mb-6">Welcome back! Please sign in to continue</p>

        <SignIn
          appearance={{
            layout: {
              logoPlacement: "none",
            },
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl border border-gray-200 rounded-2xl",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
            },
          }}
          fallbackRedirectUrl={`${basePath}/dashboard`}
          signUpUrl={`${basePath}/register`}
        />
      </div>
    </div>
  );
}

export function TenantLoginForm(props: TenantLoginFormProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <LoginFormInner {...props} />
    </Suspense>
  );
}
