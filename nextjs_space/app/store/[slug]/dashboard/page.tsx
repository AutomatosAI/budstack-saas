"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import {
  Calendar,
  Pill,
  FileText,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(`/store/${slug}/login`);
    }
  }, [isLoaded, isSignedIn, router, slug]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return null;
  }

  return (
    <div className="min-h-screen saas-shell pt-24 pb-20">
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <span className="saas-pill text-slate-600">Customer Dashboard</span>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Welcome back, {user.fullName || user.firstName || "User"}!
          </h1>
          <p className="mt-2 text-slate-500">
            Manage your consultations, prescriptions, and account settings.
          </p>
        </div>

        {/* Verification Status - Show for all new users */}
        <div className="mb-8 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
          <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            <h3 className="mb-2 font-semibold text-amber-900">
              Account Verification Pending
            </h3>
            <p className="mb-4 text-sm text-amber-800">
              Your consultation is being reviewed. You'll receive an email once
              your account is verified.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="saas-card border-0 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-full bg-blue-100 p-2">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-2xl font-semibold text-slate-900">0</span>
            </div>
            <h3 className="text-sm font-medium text-slate-500">
              Upcoming Consultations
            </h3>
          </div>

          <div className="saas-card border-0 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-full bg-emerald-100 p-2">
                <Pill className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-2xl font-semibold text-slate-900">0</span>
            </div>
            <h3 className="text-sm font-medium text-slate-500">
              Active Prescriptions
            </h3>
          </div>

          <div className="saas-card border-0 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-full bg-purple-100 p-2">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-2xl font-semibold text-slate-900">0</span>
            </div>
            <h3 className="text-sm font-medium text-slate-500">
              Order History
            </h3>
          </div>

          <div className="saas-card border-0 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="rounded-full bg-amber-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-2xl font-semibold text-slate-900">
                Pending
              </span>
            </div>
            <h3 className="text-sm font-medium text-slate-500">
              Verification Status
            </h3>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Recent Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Consultations */}
            <div className="saas-card border-0 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Recent Consultations
                </h2>
              </div>

              <div className="py-12 text-center">
                <Calendar className="mx-auto mb-4 h-16 w-16 text-slate-200" />
                <p className="mb-4 text-slate-500">No consultations yet</p>
                <Link href={`/store/${slug}/consultation`}>
                  <Button className="bg-slate-900 text-white hover:bg-slate-800">
                    Schedule Consultation
                  </Button>
                </Link>
              </div>
            </div>

            {/* Active Prescriptions */}
            <div className="saas-card border-0 p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Active Prescriptions
                </h2>
                <Link href={`/store/${slug}/products`}>
                  <Button variant="outline" size="sm">
                    Browse Products
                  </Button>
                </Link>
              </div>

              <div className="py-12 text-center">
                <Pill className="mx-auto mb-4 h-16 w-16 text-slate-200" />
                <p className="mb-4 text-slate-500">No active prescriptions</p>
                <p className="text-sm text-slate-400">
                  Complete a consultation to receive a prescription
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="saas-card border-0 p-6">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link href={`/store/${slug}/consultation`} className="block">
                  <Button className="w-full justify-start bg-slate-900 text-white hover:bg-slate-800">
                    <Calendar className="mr-2 h-4 w-4" />
                    Book Consultation
                  </Button>
                </Link>
                <Link href={`/store/${slug}/products`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Pill className="mr-2 h-4 w-4" />
                    View Products
                  </Button>
                </Link>
                <Link href={`/store/${slug}/settings`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <User className="mr-2 h-4 w-4" />
                    Account Settings
                  </Button>
                </Link>
                <Link href={`/store/${slug}/contact`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    Contact Support
                  </Button>
                </Link>
              </div>
            </div>

            {/* Account Info */}
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Account Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-slate-500">Email:</span>
                  <p className="text-slate-900">{user.primaryEmailAddress?.emailAddress}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Role:</span>
                  <p className="text-slate-900">
                    {(user.publicMetadata?.role as string) || "PATIENT"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Status:</span>
                  <p className="text-slate-900">Pending Verification</p>
                </div>
              </div>
            </div>

            {/* Help & Resources */}
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Help & Resources
              </h3>
              <div className="space-y-2 text-sm">
                <Link
                  href={`/store/${slug}/how-it-works`}
                  className="block text-slate-600 hover:text-slate-900 hover:underline"
                >
                  → How It Works
                </Link>
                <Link
                  href={`/store/${slug}/conditions`}
                  className="block text-slate-600 hover:text-slate-900 hover:underline"
                >
                  → Treatable Conditions
                </Link>
                <Link
                  href={`/store/${slug}/faq`}
                  className="block text-slate-600 hover:text-slate-900 hover:underline"
                >
                  → FAQ
                </Link>
                <Link
                  href={`/store/${slug}/the-wire`}
                  className="block text-slate-600 hover:text-slate-900 hover:underline"
                >
                  → Blog & Articles
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
