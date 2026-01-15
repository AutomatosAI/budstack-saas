"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function TenantLoginForm() {
  const params = useParams();
  const slug = params?.slug as string;

  // Fetch tenant data for branding (optional, Clerk handles some of this if Org based, usually)
  // For now, we just want to show the SignIn component.

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl border border-gray-200 rounded-2xl"
          }
        }}
        fallbackRedirectUrl={`/store/${slug}/dashboard`}
        signUpUrl={`/store/${slug}/register`}
      />
    </div>
  );
}

export default function TenantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <TenantLoginForm />
    </Suspense>
  );
}
