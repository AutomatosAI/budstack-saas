import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import {
  deriveVerificationStatus,
  VERIFICATION_STATUS_DISPLAY,
} from "@/lib/drgreen/approval-status";
import CustomerEditForm from "./customer-edit-form";
import CustomerActions from "./customer-actions";
import CustomerTags from "./customer-tags";
import MarketingConsentCard from "./marketing-consent-card";
import { Breadcrumbs, RowPill } from "@/components/admin/shared";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await currentUser();

  if (
    !user ||
    !["TENANT_ADMIN", "SUPER_ADMIN"].includes((user.publicMetadata.role as string) || "")
  ) {
    redirect("/auth/login");
  }

  // Tenant scope: TENANT_ADMIN → own; impersonating SUPER_ADMIN → the
  // impersonated tenant (PRD-302); non-impersonating SUPER_ADMIN → undefined
  // (any tenant's customer, unchanged).
  let tenantId: string | undefined;
  const active = await getActiveAdminTenant();
  if (active?.isImpersonating) {
    tenantId = active.tenantId;
  } else if (user.publicMetadata.role === "TENANT_ADMIN") {
    const email = user.emailAddresses[0]?.emailAddress;
    const localUser = await prisma.users.findFirst({
      where: { email: email },
      select: { tenantId: true },
    });
    tenantId = localUser?.tenantId;
  }

  const customer = await prisma.users.findFirst({
    where: {
      id: params.id,
      role: "PATIENT",
      ...(tenantId && { tenantId }),
    },
    include: {
      _count: {
        select: {
          orders: true,
          consultations: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  if (user.publicMetadata.role === "TENANT_ADMIN" && customer.tenantId !== tenantId) {
    notFound();
  }

  // Always loaded now: the name/phone backfill for the edit form (existing
  // customers created via the ID-upload/consultation intake saved name/phone
  // only on the questionnaire) PLUS the Dr Green approval mirror for the
  // Verification card below. Last-known state — no Dr Green API call here.
  const questionnaire = customer.email
    ? await prisma.consultation_questionnaires.findFirst({
        where: {
          email: { equals: customer.email, mode: "insensitive" },
          ...(customer.tenantId && { tenantId: customer.tenantId }),
        },
        orderBy: { createdAt: "desc" },
        select: {
          firstName: true,
          lastName: true,
          phoneCode: true,
          phoneNumber: true,
          isKycVerified: true,
          adminApproval: true,
          idDocumentStatus: true,
          kycLink: true,
          drGreenClientId: true,
          updatedAt: true,
        },
      })
    : null;

  const verificationStatus = deriveVerificationStatus({
    hasQuestionnaire: !!questionnaire,
    isKycVerified: questionnaire?.isKycVerified,
    adminApproval: questionnaire?.adminApproval,
    idDocumentStatus: questionnaire?.idDocumentStatus,
  });
  const verificationDisplay = VERIFICATION_STATUS_DISPLAY[verificationStatus];
  // US-024: the customer's tag chips. Tag rows always carry the tenant they
  // were created under; the extra tenant predicate keeps a super-admin's
  // cross-tenant view scoped to the row's own tenant.
  const tagRows = await prisma.customer_tags.findMany({
    where: {
      userId: customer.id,
      ...(customer.tenantId && { tenantId: customer.tenantId }),
    },
    select: { tag: true },
    orderBy: { tag: "asc" },
  });
  const tags = tagRows.map((row: { tag: string }) => row.tag);

  const [derivedFirst, ...derivedRest] = (customer.name ?? "").trim().split(/\s+/);
  const resolvedCustomer = {
    ...customer,
    firstName: customer.firstName ?? questionnaire?.firstName ?? (derivedFirst || null),
    lastName: customer.lastName ?? questionnaire?.lastName ?? (derivedRest.join(" ") || null),
    phone:
      customer.phone ??
      (questionnaire?.phoneNumber
        ? `${questionnaire.phoneCode ?? ""} ${questionnaire.phoneNumber}`.trim()
        : null),
  };

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/tenant-admin" },
          { label: "Customers", href: "/tenant-admin/customers" },
          { label: customer.name || customer.email || "Customer Details" },
        ]}
      />

      <header className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          {customer.name || customer.email}
        </h1>
        <p className="bs-page-subtitle font-mono">{customer.email}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CustomerEditForm customer={resolvedCustomer} />

          <section className="bs-card bs-card-pad">
            <div className="bs-card-head mb-4">
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Order History
              </h2>
            </div>
            <p className="text-sm text-bs-fg-muted">
              Total Orders:{" "}
              <span className="font-mono tabular-nums font-semibold text-bs-fg">
                {customer._count.orders}
              </span>
            </p>
            <p className="text-sm text-bs-fg-muted mt-2">
              Integration with Dr. Green API for detailed order history
            </p>
          </section>

          <section className="bs-card bs-card-pad">
            <div className="bs-card-head mb-4">
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Consultation History
              </h2>
            </div>
            <p className="text-sm text-bs-fg-muted">
              Total Consultations:{" "}
              <span className="font-mono tabular-nums font-semibold text-bs-fg">
                {customer._count.consultations}
              </span>
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bs-card bs-card-pad">
            <div className="bs-card-head mb-4 flex items-center justify-between">
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Verification
              </h2>
              <RowPill tone={verificationDisplay.tone}>
                {verificationDisplay.label}
              </RowPill>
            </div>
            <dl className="space-y-2 text-sm">
              {questionnaire?.idDocumentStatus && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-bs-fg-muted">ID document</dt>
                  <dd className="font-mono text-bs-fg">
                    {questionnaire.idDocumentStatus === "UPLOAD_FAILED"
                      ? "Upload failed"
                      : "Uploaded"}
                  </dd>
                </div>
              )}
              {questionnaire?.drGreenClientId && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-bs-fg-muted">Dr Green client</dt>
                  <dd
                    className="font-mono text-xs text-bs-fg truncate max-w-[160px]"
                    title={questionnaire.drGreenClientId}
                  >
                    {questionnaire.drGreenClientId}
                  </dd>
                </div>
              )}
              {questionnaire && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-bs-fg-muted">Last synced</dt>
                  <dd className="font-mono text-bs-fg">
                    {format(questionnaire.updatedAt, "MMM d, yyyy HH:mm")}
                  </dd>
                </div>
              )}
            </dl>
            {questionnaire &&
              !questionnaire.isKycVerified &&
              questionnaire.kycLink &&
              verificationStatus !== "VERIFIED" && (
                <a
                  href={questionnaire.kycLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bs-btn bs-btn-ghost bs-btn-sm mt-4 w-full"
                >
                  Open customer&apos;s KYC link
                </a>
              )}
            {!questionnaire && (
              <p className="text-sm text-bs-fg-muted">
                This customer has not submitted a consultation, so they have no
                Dr Green verification record yet.
              </p>
            )}
            <p className="mt-3 text-[11px] text-bs-fg-muted">
              Last-known status from Dr Green — approvals happen in the Dr Green
              admin. Use &quot;Refresh from Dr Green&quot; on the Customers list
              to sync.
            </p>
          </section>

          <section className="bs-card bs-card-pad">
            <div className="bs-card-head mb-4">
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Tags
              </h2>
            </div>
            <CustomerTags customerId={customer.id} initialTags={tags} />
          </section>

          <section className="bs-card bs-card-pad">
            <div className="bs-card-head mb-4">
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Marketing Consent
              </h2>
            </div>
            <MarketingConsentCard
              customerId={customer.id}
              marketingConsentAt={
                customer.marketingConsentAt?.toISOString() ?? null
              }
            />
          </section>

          <section className="bs-card bs-card-pad">
            <div className="bs-card-head mb-4">
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                Actions
              </h2>
            </div>
            <CustomerActions customer={customer} />
          </section>
        </div>
      </div>
    </div>
  );
}
