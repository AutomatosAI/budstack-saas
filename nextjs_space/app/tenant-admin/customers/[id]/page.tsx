import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CustomerEditForm from "./customer-edit-form";
import CustomerActions from "./customer-actions";
import { Breadcrumbs } from "@/components/admin/shared";

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

  let tenantId: string | undefined;
  if (user.publicMetadata.role === "TENANT_ADMIN") {
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
        <div className="bs-eyebrow">Customer</div>
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
          <CustomerEditForm customer={customer} />

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
