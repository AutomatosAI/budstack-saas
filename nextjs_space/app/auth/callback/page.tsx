
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AuthCallbackPage() {
    const user = await currentUser();

    if (!user) {
        return redirect("/auth/login");
    }

    // Check role in metadata
    const role = user.publicMetadata.role as string;
    const email = user.emailAddresses[0]?.emailAddress;

    // 1. Super Admin
    if (role === "SUPER_ADMIN") {
        return redirect("/super-admin");
    }

    // 2. Tenant Admin
    if (role === "TENANT_ADMIN") {
        // Optional: Double check if they are linked to a tenant
        // But metadata is usually enough for routing.
        return redirect("/tenant-admin");
    }

    // 3. Patient — redirect to storefront patient dashboard
    if (role === "PATIENT") {
        // Find their tenant to build the subdomain dashboard URL
        const localUser = await prisma.users.findFirst({ where: { email }, include: { tenants: { select: { subdomain: true } } } });
        if (localUser?.tenants?.subdomain) {
            return redirect(`/store/${localUser.tenants.subdomain}/dashboard`);
        }
        return redirect("/");
    }

    // 4. No role — try DB lookup as fallback (sync issue?)
    if (!role) {
        const localUser = await prisma.users.findFirst({ where: { email }, include: { tenants: { select: { subdomain: true } } } });
        if (localUser?.role === "SUPER_ADMIN") return redirect("/super-admin");
        if (localUser?.role === "TENANT_ADMIN") return redirect("/tenant-admin");
        if (localUser?.role === "PATIENT" && localUser?.tenants?.subdomain) {
            return redirect(`/store/${localUser.tenants.subdomain}/dashboard`);
        }
    }

    // Default fallback
    return redirect("/");
}
