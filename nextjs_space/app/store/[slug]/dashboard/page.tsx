"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Pill,
  User,
  AlertCircle,
  CheckCircle2,
  ShoppingBag,
  Package,
  Wallet,
  ArrowRight,
  LifeBuoy,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { checkUserKycStatus, KycStatus } from "@/app/actions/kyc-check";
import { getStorefrontDashboard, StorefrontDashboard } from "@/app/actions/dashboard";
import { OrderListItem, money } from "@/components/storefront/order-list-item";
import { getTenantBasePath } from "@/lib/tenant/tenant-utils";
import { ReUploadIdDocument } from "@/components/shop/ReUploadIdDocument";

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              accent ? "bg-primary/10 text-primary" : "bg-muted text-foreground/70"
            }`}
          >
            {icon}
          </span>
          <span className="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const basePath = getTenantBasePath(slug);

  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null);
  const [data, setData] = useState<StorefrontDashboard | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    checkUserKycStatus().then(setKycStatus);
    getStorefrontDashboard(5)
      .then(setData)
      .finally(() => setOrdersLoading(false));
  }, []);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push(`${basePath}/login`);
  }, [isLoaded, isSignedIn, router, slug]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!isSignedIn || !user) return null;

  const verified = !!kycStatus?.kycVerified;
  const showClinical = data?.verificationMode !== "ID_UPLOAD"; // KYC tenants only
  // PRD-220 Part B: registration succeeded but the inline ID upload failed —
  // only meaningful for ID-upload tenants and only while unverified.
  const idUploadFailed =
    !verified && !showClinical && kycStatus?.idDocumentStatus === "UPLOAD_FAILED";
  const orders = data?.orders ?? [];

  return (
    <div
      className="min-h-screen pb-20 pt-24"
      style={{ backgroundColor: "hsl(var(--tenant-color-background, 210 40% 98%))" }}
    >
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8">
          <p className="text-sm font-medium text-primary">Your account</p>
          <h1
            className="mt-1 text-3xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--tenant-font-heading, inherit)" }}
          >
            Welcome back, {user.firstName || user.fullName || "there"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {showClinical
              ? "Your consultations, prescriptions and orders in one place."
              : "Track your orders and manage your account."}
          </p>
        </header>

        {/* Verification banner */}
        {verified ? (
          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-900">You&apos;re verified</h3>
                <p className="text-sm text-emerald-800">
                  Your account is approved — you can purchase medical cannabis products.
                </p>
              </div>
            </div>
            <Link href={`${basePath}/products`} className="flex-shrink-0">
              <Button className="w-full sm:w-auto">
                <ShoppingBag className="mr-2 h-4 w-4" /> Start shopping
              </Button>
            </Link>
          </div>
        ) : idUploadFailed ? (
          /* PRD-220 Part B: the inline upload during registration failed —
             the account exists but Dr Green never received the document.
             Say so and offer the re-upload right here. */
          <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50/70 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-rose-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-rose-900">
                  We didn&apos;t receive your ID document
                </h3>
                <p className="text-sm text-rose-800">
                  Your account was created, but the ID upload didn&apos;t go through —
                  verification can&apos;t start until we have it. Please upload it again below.
                </p>
                <ReUploadIdDocument
                  slug={slug}
                  onUploaded={() => checkUserKycStatus().then(setKycStatus)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`mb-8 flex items-start gap-3 rounded-2xl border p-5 ${
              kycStatus?.status === "API_ERROR"
                ? "border-rose-200 bg-rose-50/70"
                : "border-amber-200 bg-amber-50/70"
            }`}
          >
            <AlertCircle
              className={`mt-0.5 h-6 w-6 flex-shrink-0 ${
                kycStatus?.status === "API_ERROR" ? "text-rose-600" : "text-amber-600"
              }`}
            />
            <div>
              <h3
                className={`font-semibold ${
                  kycStatus?.status === "API_ERROR" ? "text-rose-900" : "text-amber-900"
                }`}
              >
                {kycStatus?.status === "API_ERROR"
                  ? "Verification error"
                  : "Verification pending"}
              </h3>
              <p
                className={`text-sm ${
                  kycStatus?.status === "API_ERROR" ? "text-rose-800" : "text-amber-800"
                }`}
              >
                {kycStatus?.message ||
                  (showClinical
                    ? "Complete your consultation to get verified. You'll get an email once approved."
                    : "Your ID is being reviewed. You'll get an email once your account is approved.")}
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div
          className={`mb-8 grid gap-4 ${
            showClinical ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"
          }`}
        >
          {showClinical && (
            <>
              <StatCard icon={<Calendar className="h-5 w-5" />} label="Consultations" value={0} />
              <StatCard icon={<Pill className="h-5 w-5" />} label="Prescriptions" value={0} />
            </>
          )}
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label="Orders"
            value={data?.orderCount ?? 0}
            accent
          />
          {!showClinical && (
            <StatCard
              icon={<Wallet className="h-5 w-5" />}
              label="Total spent"
              value={money(data?.totalPaid ?? 0)}
            />
          )}
          <StatCard
            icon={
              verified ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />
            }
            label="Verification"
            value={
              <span className={verified ? "text-emerald-600" : "text-amber-600"}>
                {verified ? "Verified" : "Pending"}
              </span>
            }
          />
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: orders (+ clinical for KYC) */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Recent orders</h2>
                  {orders.length > 0 && (
                    <Link href={`${basePath}/orders`}>
                      <Button variant="ghost" size="sm" className="text-primary">
                        View all <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>

                {ordersLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-[68px] animate-pulse rounded-xl bg-muted/60" />
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" />
                    <p className="mb-1 font-medium text-foreground">No orders yet</p>
                    <p className="mb-5 text-sm text-muted-foreground">
                      When you place an order it&apos;ll show up here.
                    </p>
                    <Link href={`${basePath}/products`}>
                      <Button>
                        <ShoppingBag className="mr-2 h-4 w-4" /> Browse products
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((o) => (
                      <OrderListItem key={o.id} order={o} basePath={basePath} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {showClinical && (
              <Card className="border-border/60 shadow-sm">
                <CardContent className="p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Consultations</h2>
                    <Link href={`${basePath}/consultation`}>
                      <Button variant="outline" size="sm">
                        Book
                      </Button>
                    </Link>
                  </div>
                  <div className="py-10 text-center">
                    <Calendar className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      No consultations yet — book one to get a prescription.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: actions + account */}
          <div className="space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Quick actions</h2>
                <div className="space-y-2.5">
                  {showClinical && (
                    <Link href={`${basePath}/consultation`} className="block">
                      <Button className="w-full justify-start">
                        <Calendar className="mr-2 h-4 w-4" /> Book consultation
                      </Button>
                    </Link>
                  )}
                  <Link href={`${basePath}/products`} className="block">
                    <Button
                      className={`w-full justify-start ${showClinical ? "" : ""}`}
                      variant={showClinical ? "outline" : "default"}
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" /> Shop products
                    </Button>
                  </Link>
                  <Link href={`${basePath}/orders`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <Package className="mr-2 h-4 w-4" /> My orders
                    </Button>
                  </Link>
                  <Link href={`${basePath}/settings`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" /> Account settings
                    </Button>
                  </Link>
                  <Link href={`${basePath}/contact`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      <LifeBuoy className="mr-2 h-4 w-4" /> Contact support
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 text-base font-semibold text-foreground">Account</h3>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="truncate font-medium text-foreground">
                      {user.primaryEmailAddress?.emailAddress}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className={`font-medium ${verified ? "text-emerald-600" : "text-amber-600"}`}>
                      {verified ? "Verified" : "Pending verification"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-3 text-base font-semibold text-foreground">Help &amp; resources</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ["How it works", "how-it-works"],
                    ["Treatable conditions", "conditions"],
                    ["FAQ", "faq"],
                    ["Blog & articles", "the-wire"],
                  ].map(([label, path]) => (
                    <Link
                      key={path}
                      href={`${basePath}/${path}`}
                      className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <ArrowRight className="h-3.5 w-3.5" /> {label}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
