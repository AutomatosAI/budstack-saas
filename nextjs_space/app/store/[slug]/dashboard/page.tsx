"use client";

import { useSession } from "next-auth/react";
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
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const status = sessionResult?.status;
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/store/${slug}/login`);
    }
  }, [status, router, slug]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-24 pb-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-900 mb-2">
            Welcome back, {session?.user?.name || "User"}!
          </h1>
          <p className="text-gray-600">
            Manage your consultations, prescriptions, and account settings.
          </p>
        </div>

        {/* Verification Status - Show for all new users */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 mb-2">
              Account Verification Pending
            </h3>
            <p className="text-yellow-800 text-sm mb-4">
              Your consultation is being reviewed. You'll receive an email once
              your account is verified.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">0</span>
            </div>
            <h3 className="text-gray-600 text-sm">Upcoming Consultations</h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Pill className="w-8 h-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">0</span>
            </div>
            <h3 className="text-gray-600 text-sm">Active Prescriptions</h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <FileText className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900">0</span>
            </div>
            <h3 className="text-gray-600 text-sm">Order History</h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="w-8 h-8 text-orange-600" />
              <span className="text-2xl font-bold text-gray-900">Pending</span>
            </div>
            <h3 className="text-gray-600 text-sm">Verification Status</h3>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Recent Activity */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Consultations */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-green-900">
                  Recent Consultations
                </h2>
              </div>

              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No consultations yet</p>
                <Link href={`/store/${slug}/consultation`}>
                  <Button className="bg-green-600 hover:bg-green-700">
                    Schedule Consultation
                  </Button>
                </Link>
              </div>
            </div>

            {/* Active Prescriptions */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-green-900">
                  Active Prescriptions
                </h2>
                <Link href={`/store/${slug}/products`}>
                  <Button variant="outline" size="sm">
                    Browse Products
                  </Button>
                </Link>
              </div>

              <div className="text-center py-12">
                <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No active prescriptions</p>
                <p className="text-sm text-gray-400">
                  Complete a consultation to receive a prescription
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-green-900 mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link href={`/store/${slug}/consultation`} className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700 justify-start">
                    <Calendar className="w-4 h-4 mr-2" />
                    Book Consultation
                  </Button>
                </Link>
                <Link href={`/store/${slug}/products`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Pill className="w-4 h-4 mr-2" />
                    View Products
                  </Button>
                </Link>
                <Link href={`/store/${slug}/settings`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <User className="w-4 h-4 mr-2" />
                    Account Settings
                  </Button>
                </Link>
                <Link href={`/store/${slug}/contact`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </Link>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <h3 className="font-semibold text-green-900 mb-4">
                Account Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-green-700 font-medium">Email:</span>
                  <p className="text-green-900">{session?.user?.email}</p>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Role:</span>
                  <p className="text-green-900">
                    {(session?.user as any)?.role || "PATIENT"}
                  </p>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Status:</span>
                  <p className="text-green-900">Pending Verification</p>
                </div>
              </div>
            </div>

            {/* Help & Resources */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-4">
                Help & Resources
              </h3>
              <div className="space-y-2 text-sm">
                <Link
                  href={`/store/${slug}/how-it-works`}
                  className="block text-blue-700 hover:text-blue-900 hover:underline"
                >
                  → How It Works
                </Link>
                <Link
                  href={`/store/${slug}/conditions`}
                  className="block text-blue-700 hover:text-blue-900 hover:underline"
                >
                  → Treatable Conditions
                </Link>
                <Link
                  href={`/store/${slug}/faq`}
                  className="block text-blue-700 hover:text-blue-900 hover:underline"
                >
                  → FAQ
                </Link>
                <Link
                  href={`/store/${slug}/the-wire`}
                  className="block text-blue-700 hover:text-blue-900 hover:underline"
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
